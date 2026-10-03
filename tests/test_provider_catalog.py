"""Ağ ve gerçek anahtar kullanmadan katalog/veri sözleşmesini doğrular."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('catalog_updater', ROOT / 'tools/update-provider-catalog.py')
UPDATER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(UPDATER)
SOURCE_SHA = 'fc09da34f9fb8e13c77bde9d57fb723b99c5215855ec631592beff74f7ef9295'
# Models.dev snapshot 2026-10-03; MIT, source digest above. No API/model execution.
SOURCE_IDS = set('302ai abacus abliteration-ai above agentrouter agnes ai-router ai21 aiand aihubmix ainetcafe aixy aki-io alibaba alibaba-cn alibaba-coding-plan alibaba-coding-plan-cn alibaba-token-plan alibaba-token-plan-cn amazon-bedrock ambient amd anthropic anyapi arcee atomic-chat auriko azure azure-cognitive-services bailing baseten bee berget blueclaw bothub cerebras chutes clarifai claudinio cline-pass cloudferro-sherlock cloudflare-ai-gateway cloudflare-workers-ai cohere coralbricks cortecs crof crossmodel crusoe daoxe databricks deepinfra deepseek digitalocean dinference drun ebcloud echo edenai empiriolabs engy evroc fastrouter fireworks-ai freemodel friendli frogbot github-copilot gitlab gmicloud google google-vertex google-vertex-anthropic greenpt groq helicone hetzner hpc-ai huggingface hyper iflowcn impossibl inception inceptron inco infer inference inferx infomaniak io-net iteracompute jalapeno jiekou kenari kilo kimi-code-plan-cn kimi-code-plan-global klokintegration kosmik kuae-cloud-coding-plan lilac llama llmgateway llmgateway-providers llmtech llmtr lmstudio longcat lucidquery lynkr meganova melious merge-gateway meta minimax minimax-cn minimax-cn-coding-plan minimax-coding-plan mistral mixlayer moark modal model-oracle-ai modelis modelscope moonshotai moonshotai-cn morph nan nano-gpt nearai nebius neon neosmith neuralwatt nova novita-ai nvidia oci ofox ollama-cloud openai opencode opencode-go openreason openrouter opper orcarouter ovhcloud pareto pendra perplexity perplexity-agent pioneer poe poolside privatemode-ai qihang-ai qiniu-ai qvac regolo-ai requesty routing-run runinfra sakana salad-cloud sap-ai-core sarvam scaleway scnet-token-plan scx-ai sensenova siliconflow siliconflow-cn snowflake-cortex stackit standardcompute stepfun stepfun-ai stepfun-ai-step-plan stepfun-step-plan subconscious submodel synthetic tempr tencent-coding-plan tencent-token-plan tencent-tokenhub tensorx the-grid-ai thinkingmachines tinfoil togetherai tokengo tokenrouter trustedrouter umans-ai umans-ai-coding-plan unorouter upstage v0 vancine venice vercel vispark vivgrid volcengine volcengine-coding-plan vultr wafer.ai wallaby wandb watsonx xai xiaomi xiaomi-token-plan-ams xiaomi-token-plan-cn xiaomi-token-plan-sgp xpersona zai zai-coding-plan zeldoc zenifra zenmux zhipuai zhipuai-coding-plan'.split())


def model(name='Metin modeli', inputs=None, outputs=None, **values):
    return {'name': name, 'modalities': {'input': inputs or ['text'], 'output': outputs or ['text']}, **values}


def source(identifier='example', npm='@ai-sdk/openai-compatible', api='https://example.test/v1', models=None):
    return {identifier: {'id': identifier, 'name': identifier, 'npm': npm, 'api': api,
                         'env': [], 'doc': 'https://example.test/docs', 'models': models or {'text-model': model()}}}


def catalog(data):
    return UPDATER.make_catalog(data, '2026-10-03', '0' * 64)


def provider(data, identifier='example'):
    return next(entry for entry in catalog(data)['providers'] if entry['id'] == identifier)


class CatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        path = ROOT / 'lib/provider-catalog.js'
        command = 'const fs=require("fs"),vm=require("vm"); process.stdout.write(vm.runInNewContext(fs.readFileSync(process.argv[1],"utf8")+"\\nJSON.stringify(PROVIDER_CATALOG)",{}));'
        cls.bundled = json.loads(subprocess.check_output(['node', '-e', command, str(path)]))
        cls.entries = {entry['id']: entry for entry in cls.bundled['providers']}

    def test_01_all_snapshot_provider_ids_retained(self):
        self.assertEqual(set(self.entries), SOURCE_IDS | {'ollama', 'llamacpp'})
        self.assertEqual(len(SOURCE_IDS), 226)

    def test_02_snapshot_provenance_and_license(self):
        self.assertEqual(self.bundled['source']['sha256'], SOURCE_SHA)
        self.assertEqual(self.bundled['source']['fetchedOn'], '2026-10-03')
        self.assertEqual(self.bundled['source']['license'], 'MIT')
        self.assertIn(UPDATER.SOURCE_LICENSE, (ROOT / 'lib/provider-catalog.js').read_text())

    def test_03_no_live_verification_claims(self):
        self.assertTrue(all(entry['liveVerified'] is False for entry in self.entries.values()))

    def test_04_ids_unique(self):
        self.assertEqual(len(self.entries), len(self.bundled['providers']))
        for entry in self.entries.values():
            self.assertEqual(len(entry['models']), len({item['id'] for item in entry['models']}))

    def test_05_selectable_urls_and_protocols(self):
        protocols = set(UPDATER.PROTOCOLS.values()) - {'unsupported'}
        for entry in self.entries.values():
            if entry['selectable']:
                self.assertTrue(UPDATER.valid_url(entry['baseURL']) or
                                entry.get('requiresBaseURL') is True and entry['baseURL'] == '', entry['id'])
                self.assertIn(entry['protocol'], protocols)

    def test_06_unsafe_endpoints_rejected(self):
        for url in ['javascript:alert(1)', 'http://public.example/v1', 'https://user:token@example.test/v1',
                    'https://example.test/v1?api_key=fake', 'https://example.test/#fragment']:
            self.assertFalse(UPDATER.valid_url(url))
        self.assertFalse(provider(source(api='http://public.example/v1'))['selectable'])

    def test_07_loopback_and_template_endpoints(self):
        for url in ['http://127.0.0.1:11434/v1', 'http://localhost:1234/v1', 'http://[::1]:8080/v1',
                    'https://{resourceName}.openai.azure.com/openai/v1', '{gatewayBaseURL}/v1']:
            self.assertTrue(UPDATER.valid_url(url))

    def test_08_mismatched_source_identity_rejected(self):
        data = source()
        data['example']['id'] = 'different'
        with self.assertRaises(ValueError): catalog(data)

    def test_09_invalid_model_map_rejected(self):
        data = source()
        data['example']['models'] = []
        with self.assertRaises(ValueError): catalog(data)

    def test_10_unknown_provider_sdk_is_catalog_only(self):
        entry = provider(source(npm='custom-sdk-not-reviewed'))
        self.assertFalse(entry['selectable'])
        self.assertEqual(entry['protocol'], 'unsupported')

    def test_11_unknown_model_sdk_is_unavailable(self):
        entry = provider(source(models={'custom': model(provider={'npm': 'custom-model-sdk'})}))
        self.assertFalse(entry['models'][0]['selectable'])

    def test_12_embedding_and_reranking_records_excluded(self):
        models = {'text-model': model(), 'text-embedding': model(), 'reranker': model(), 'bge-large': model()}
        self.assertEqual([item['id'] for item in provider(source(models=models))['models']], ['text-model'])

    def test_13_non_text_modalities_excluded(self):
        models = {'text-model': model(), 'image-generation': model(outputs=['image']), 'transcription': model(inputs=['audio'])}
        self.assertEqual([item['id'] for item in provider(source(models=models))['models']], ['text-model'])

    def test_14_special_text_records_unavailable(self):
        models = {'chatgpt-image-latest': model(outputs=['text', 'image']), 'gpt-realtime': model(outputs=['text', 'audio']),
                  'o3-deep-research': model(), 'computer-use-preview': model(), 'gpt-4o-search-preview': model()}
        self.assertTrue(all(item['selectable'] is False for item in provider(source(models=models))['models']))
        self.assertFalse(next(item for item in self.entries['openai']['models'] if item['id'] == 'chatgpt-image-latest')['selectable'])

    def test_15_openai_default_retained(self):
        self.assertEqual(self.bundled['default'], {'providerId': 'openai', 'model': 'gpt-4o'})
        self.assertEqual(self.entries['openai']['protocol'], 'openai-chat')
        self.assertEqual(self.entries['openai']['defaultModel'], 'gpt-4o')

    def test_16_openai_responses_only_override(self):
        item = next(item for item in self.entries['openai']['models'] if item['id'] == 'gpt-5.4-pro')
        self.assertEqual(item['protocol'], 'openai-responses')

    def test_17_unimplemented_identity_flows_unavailable(self):
        for identifier in ['github-copilot', 'gitlab', 'v0']:
            self.assertFalse(self.entries[identifier]['selectable'])
            self.assertTrue(self.entries[identifier]['supportNote'])

    def test_18_cloudflare_gateway_wire_protocol_and_header(self):
        entry = self.entries['cloudflare-ai-gateway']
        self.assertEqual(entry['authHeader'], 'cf-aig-authorization')
        self.assertTrue(all(item.get('protocol', entry['protocol']) == 'openai-chat' for item in entry['models']))

    def test_19_qvac_alias_boundary(self):
        entry = self.entries['qvac']
        self.assertTrue(entry['local'])
        self.assertTrue(entry['requiresManualModel'])
        self.assertEqual(entry['authType'], 'none')

    def test_20_all_url_template_fields_declared(self):
        import re
        for entry in self.entries.values():
            keys = {item['key'] for item in entry['fields']}
            for url in [entry['baseURL']] + [item.get('baseURL', '') for item in entry['models']]:
                self.assertTrue(set(re.findall(r'\{([a-zA-Z0-9_]+)\}', url)).issubset(keys), entry['id'])

    def test_21_azure_canonical_fields(self):
        self.assertEqual(UPDATER.normalize_url('https://${AZURE_RESOURCE_NAME}.openai.azure.com'), 'https://{resourceName}.openai.azure.com')
        for identifier in ['azure', 'azure-cognitive-services']:
            fields = {item['key']: item for item in self.entries[identifier]['fields']}
            self.assertFalse(fields['deploymentName']['required'])

    def test_22_azure_legacy_model_api_normalized(self):
        data = source('azure', '@ai-sdk/azure', api=None, models={'maas-model': model(provider={'npm': '@ai-sdk/openai-compatible', 'api': 'https://${AZURE_RESOURCE_NAME}.services.ai.azure.com/models'})})
        self.assertEqual(provider(data, 'azure')['models'][0]['baseURL'], 'https://{resourceName}.openai.azure.com/openai/v1')

    def test_23_mantle_responses_endpoint_and_discovery(self):
        items = [item for item in self.entries['amazon-bedrock']['models'] if '.api.aws/' in item.get('baseURL', '')]
        self.assertEqual(len(items), 16)
        for item in items:
            self.assertEqual(item['protocol'], 'openai-responses')
            self.assertTrue(item['baseURL'].endswith('.api.aws/v1'))
            self.assertEqual(item['modelListPath'], '/models')
            self.assertIsNot(item.get('selectable'), False)

    def test_24_discovery_paths_never_guessed_for_cloud(self):
        for identifier in ['amazon-bedrock', 'snowflake-cortex', 'azure', 'azure-cognitive-services', 'google-vertex', 'google-vertex-anthropic', 'watsonx', 'sap-ai-core']:
            self.assertIsNone(self.entries[identifier]['modelListPath'])

    def test_25_deterministic_safe_serialization(self):
        data = source(models={'safe': model(name='<script>\u2028\u2029')})
        first = UPDATER.render(catalog(data))
        self.assertEqual(first, UPDATER.render(catalog(copy.deepcopy(data))))
        self.assertNotIn('<script>', first)
        self.assertIn('\\u003cscript>', first)
        self.assertIn('\\u2028', first)

    def test_26_updater_hash_and_offline_check(self):
        with tempfile.TemporaryDirectory() as directory:
            src, out = Path(directory) / 'source.json', Path(directory) / 'catalog.js'
            src.write_text(json.dumps(source()))
            digest = hashlib.sha256(src.read_bytes()).hexdigest()
            command = ['python3', str(ROOT / 'tools/update-provider-catalog.py'), '--source', str(src), '--source-date', '2026-10-03', '--output', str(out)]
            failed = subprocess.run(command + ['--expected-sha256', 'f' * 64], capture_output=True)
            self.assertNotEqual(failed.returncode, 0)
            self.assertFalse(out.exists())
            self.assertEqual(subprocess.run(command + ['--expected-sha256', digest], capture_output=True).returncode, 0)
            self.assertEqual(subprocess.run(command + ['--expected-sha256', digest, '--check'], capture_output=True).returncode, 0)
            out.write_text('modified')
            self.assertNotEqual(subprocess.run(command + ['--check'], capture_output=True).returncode, 0)

    def test_27_package_dependency_registry_and_service(self):
        spec = importlib.util.spec_from_file_location('store_packager', ROOT / 'tools/package-store.py')
        packager = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(packager)
        _, files = packager.collect_files(ROOT)
        self.assertIn('lib/provider-catalog.js', files)
        self.assertIn('background/provider-service.js', files)
        self.assertNotIn('lib/crypto-js.min.js', files)
        self.assertTrue(all(not item.startswith(('output/', 'tools/', 'tests/', 'docs/')) for item in files))

    def test_28_watsonx_iam_profile_contract(self):
        entry = self.entries['watsonx']
        self.assertTrue(entry['selectable'])
        self.assertEqual((entry['protocol'], entry['authType']), ('watsonx-chat', 'iam'))
        self.assertEqual(entry['baseURL'], 'https://us-south.ml.cloud.ibm.com')
        self.assertIn('https://iam.cloud.ibm.com/*', entry['origins'])
        fields = {item['key']: item for item in entry['fields']}
        self.assertTrue(fields['apiKey']['required'])
        self.assertFalse(fields['projectId']['required'])
        self.assertFalse(fields['spaceId']['required'])
        self.assertEqual(fields['apiVersion']['default'], '2024-10-08')

    def test_29_sap_oauth_and_orchestration_profile_contract(self):
        entry = self.entries['sap-ai-core']
        self.assertTrue(entry['selectable'])
        self.assertEqual((entry['protocol'], entry['authType']), ('sap-orchestration-v2', 'oauth-client-credentials'))
        self.assertFalse(entry['usesAPIKey'])
        self.assertTrue(entry['requiresBaseURL'])
        self.assertEqual(entry['baseURL'], '')
        fields = {item['key']: item for item in entry['fields']}
        self.assertNotIn('apiKey', fields)
        self.assertNotIn('baseURL', fields)
        for key in ['clientId', 'clientSecret', 'tokenURL', 'deploymentId', 'resourceGroup']:
            self.assertTrue(fields[key]['required'])
        self.assertEqual(fields['clientSecret']['type'], 'password')
        self.assertEqual(fields['tokenURL']['type'], 'url')
        self.assertNotIn('default', fields['apiVersion'])
        self.assertEqual(fields['sapMode']['default'], 'orchestration')
        self.assertEqual([item['value'] for item in fields['sapMode']['options']], ['orchestration', 'openai'])

    def test_30_native_auth_transport_cannot_be_overridden_by_model_sdk(self):
        for identifier, npm, protocol in [
                ('watsonx', 'watsonx-ai-provider', 'watsonx-chat'),
                ('sap-ai-core', '@jerome-benoit/sap-ai-provider-v2', 'sap-orchestration-v2')]:
            data = source(identifier, npm, models={'upstream': model(provider={
                'npm': '@ai-sdk/openai', 'api': 'https://upstream.example/v1'})})
            entry = provider(data, identifier)
            self.assertEqual(entry['protocol'], protocol)
            self.assertNotIn('protocol', entry['models'][0])
            self.assertNotIn('baseURL', entry['models'][0])


if __name__ == '__main__':
    unittest.main()
