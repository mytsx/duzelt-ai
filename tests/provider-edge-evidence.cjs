const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const sourceFiles = ['background/openai-provider.js', 'lib/provider-catalog.js', 'background/provider-service.js'];
const context = vm.createContext({ URL, Headers, AbortController, setTimeout, clearTimeout });
const sourceSHA256 = {};
for (const file of sourceFiles) {
    const source = fs.readFileSync(path.join(root, file));
    sourceSHA256[file] = crypto.createHash('sha256').update(source).digest('hex');
    vm.runInContext(source.toString(), context);
}
const catalog = vm.runInContext('PROVIDER_CATALOG', context);
const service = context.ProviderService;
const protocols = {};
let selectableProviders = 0;
let selectableModels = 0;
let manualLocalModelFixtures = 0;
const unsupportedAuthBypasses = [];

for (const provider of catalog.providers) {
    const profile = {
        apiKey: 'Review-Builder-KeyOnly', resourceName: 'review-resource', region: 'us-central1', location: 'us-central1',
        projectId: 'review-project', accountId: 'a'.repeat(32), account: 'review-org-account',
        gatewayId: 'review-gateway', host: 'review.cloud.databricks.com', productId: '123',
        gatewayBaseURL: 'https://review.example/v1', vertexEndpoint: 'us-central1-aiplatform.googleapis.com'
    };
    if (provider.id === 'watsonx') profile.apiVersion = '2024-10-08';
    if (provider.id === 'sap-ai-core') Object.assign(profile, {
        apiKey: '', clientId: 'review-client', clientSecret: 'Review-Builder-SecretOnly',
        tokenURL: 'https://review.authentication.example/oauth/token', baseURL: 'https://review.aicore.example/v2',
        resourceGroup: 'default', deploymentId: 'review-deployment', sapMode: 'orchestration'
    });
    for (const field of provider.fields || []) {
        if (!(field.key in profile) && field.default) profile[field.key] = field.default;
        else if (!(field.key in profile) && field.required) profile[field.key] = 'review';
    }
    if (provider.selectable === false) {
        try { service.resolveProfile(provider.id, { ...profile, model: provider.models[0]?.id || 'review-model' }); unsupportedAuthBypasses.push(provider.id); } catch {}
        continue;
    }
    selectableProviders++;
    for (const model of (provider.models.length ? provider.models : [{ id: 'review-model' }]).filter(item => item.selectable !== false)) {
        const resolved = service.resolveProfile(provider.id, { ...profile, model: model.id });
        const request = service.buildCorrectionRequest(resolved, 'Bağımsız örnek metin.');
        const url = new URL(request.url);
        assert.equal(url.origin, new URL(resolved.baseURL).origin, provider.id + '/' + model.id);
        assert.equal(/[{}$<>]/.test(request.url), false, provider.id + '/' + model.id);
        assert.equal((url.pathname.match(/\/projects\//g) || []).length, resolved.isVertex ? 1 : 0, provider.id + '/' + model.id);
        assert.equal(request.url.includes('Review-Builder-KeyOnly') || request.url.includes('Review-Builder-SecretOnly'), false);
        assert.ok(request.body, provider.id + '/' + model.id);
        protocols[resolved.protocol] = (protocols[resolved.protocol] || 0) + 1;
        if (provider.models.length) selectableModels++;
        else manualLocalModelFixtures++;
    }
}
assert.deepEqual(unsupportedAuthBypasses, []);
const authReviewOutput = execFileSync(process.execPath, ['--test', 'tests/provider-edge-review.test.cjs'], { cwd: root, encoding: 'utf8' });
const authReviewTests = Number(authReviewOutput.match(/^# tests (\d+)$/m)?.[1]);
const authReviewPass = Number(authReviewOutput.match(/^# pass (\d+)$/m)?.[1]);
assert.ok(authReviewTests > 0);
assert.equal(authReviewTests, authReviewPass);

const evidence = {
    generatedAt: new Date().toISOString(),
    scope: 'Independent catalog request builder sweep and mocked IBM/SAP authentication, permission and privacy contract review; no live provider inference',
    command: 'node tests/provider-edge-evidence.cjs',
    catalogSource: catalog.source,
    sourceSHA256,
    networkCalls: 0,
    liveProviderInferenceVerified: false,
    providerCount: catalog.providers.length,
    selectableProviders,
    selectableModelRecords: selectableModels,
    manualLocalModelFixtures,
    successfulRequests: selectableModels + manualLocalModelFixtures,
    protocols,
    unresolvedPlaceholderErrors: [],
    duplicateProjectPaths: [],
    unsupportedAuthBypasses,
    authenticationReview: { command: 'node --test tests/provider-edge-review.test.cjs', tests: authReviewTests, passed: authReviewPass, realNetworkCalls: 0 },
    extraChecks: [
        'all-origins-required-before-token-exchange',
        'iam-and-oauth-encoded-form-separate-from-native-inference',
        'invalid-expired-token-and-redirect-stop-before-inference',
        'key-client-secret-and-access-token-url-guards',
        'provider-error-and-transport-error-secret-safe',
        'token-not-persisted-or-logged',
        'watsonx-system-string-and-user-parts',
        'sap-orchestration-final-result-and-ibm-incomplete-response'
    ],
    limitations: [
        'Account authorization, regional model availability, provider response quality and OAuth/subscription runtime are not established by mocked authentication or request construction.',
        'SAP X.509/mTLS service keys and IBM software/deployment/gateway products are outside the tested authentication contract.',
        'Browser/editor integration uses deterministic mocked OpenAI transport, documented separately in editor-results.json.'
    ]
};
fs.writeFileSync(path.join(root, 'evidence/provider-edge-review.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ providerCount: evidence.providerCount, selectableProviders, selectableModelRecords: selectableModels, manualLocalModelFixtures, successfulRequests: evidence.successfulRequests, protocols, authTestsPassed: authReviewPass, networkCalls: 0 }));
