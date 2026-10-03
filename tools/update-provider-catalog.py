#!/usr/bin/env python3
"""Public models.dev verisini statik çalışma kataloğuna dönüştürür; SDK çalıştırmaz."""

import argparse
from collections import Counter
from datetime import date
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent.parent
SOURCE_URL = 'https://models.dev/api.json'
MODELS_REVISION = '036a4f1d6ee01a0ed3f156077375a15087dd322f'
OPENCODE_REVISION = '907b3bc518fa48e90e8ec24dd327d13eee71c36c'
LICENSE_URL = f'https://raw.githubusercontent.com/anomalyco/models.dev/{MODELS_REVISION}/LICENSE'
SOURCE_LICENSE = '''MIT License

Copyright (c) 2025 models.dev

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.'''

PROTOCOLS = {
    '@ai-sdk/openai-compatible': 'openai-chat',
    '@ai-sdk/openai': 'openai-responses',
    '@openrouter/ai-sdk-provider': 'openai-chat',
    '@ai-sdk/anthropic': 'anthropic-messages',
    '@ai-sdk/google': 'gemini',
    '@ai-sdk/google-vertex': 'vertex-gemini',
    '@ai-sdk/google-vertex/anthropic': 'vertex-anthropic',
    '@ai-sdk/amazon-bedrock': 'bedrock-converse',
    '@ai-sdk/amazon-bedrock/mantle': 'openai-responses',
    '@ai-sdk/azure': 'azure-openai',
    '@ai-sdk/cohere': 'cohere-v2',
    '@ai-sdk/xai': 'openai-responses',
    '@ai-sdk/mistral': 'openai-chat',
    '@ai-sdk/groq': 'openai-chat',
    '@ai-sdk/cerebras': 'openai-chat',
    '@ai-sdk/deepinfra': 'openai-chat',
    '@ai-sdk/togetherai': 'openai-chat',
    '@ai-sdk/perplexity': 'openai-chat',
    '@ai-sdk/gateway': 'openai-chat',
    'venice-ai-sdk-provider': 'openai-chat',
    'merge-gateway-ai-sdk-provider': 'openai-chat',
    'watsonx-ai-provider': 'watsonx-chat',
    '@jerome-benoit/sap-ai-provider-v2': 'sap-orchestration-v2',
}
DEFAULT_URLS = {
    'openai': 'https://api.openai.com/v1',
    'anthropic': 'https://api.anthropic.com/v1',
    'google': 'https://generativelanguage.googleapis.com/v1beta',
    'cohere': 'https://api.cohere.com/v2',
    'xai': 'https://api.x.ai/v1',
    'mistral': 'https://api.mistral.ai/v1',
    'groq': 'https://api.groq.com/openai/v1',
    'cerebras': 'https://api.cerebras.ai/v1',
    'deepinfra': 'https://api.deepinfra.com/v1/openai',
    'togetherai': 'https://api.together.xyz/v1',
    'perplexity': 'https://api.perplexity.ai',
    'vercel': 'https://ai-gateway.vercel.sh/v1',
    'venice': 'https://api.venice.ai/api/v1',
    'merge-gateway': 'https://api-gateway.merge.dev/v1/openai',
    'aihubmix': 'https://aihubmix.com/v1',
    'salad-cloud': 'https://ai.salad.cloud/v1',
    'qvac': 'http://127.0.0.1:11434/v1',
    'cloudflare-ai-gateway': 'https://gateway.ai.cloudflare.com/v1/{accountId}/{gatewayId}/compat',
    'azure': 'https://{resourceName}.openai.azure.com/openai/v1',
    'azure-cognitive-services': 'https://{resourceName}.cognitiveservices.azure.com/openai/v1',
    'amazon-bedrock': 'https://bedrock-runtime.{region}.amazonaws.com',
    'google-vertex': 'https://{location}-aiplatform.googleapis.com/v1/projects/{projectId}/locations/{location}/publishers/google',
    'google-vertex-anthropic': 'https://{location}-aiplatform.googleapis.com/v1/projects/{projectId}/locations/{location}/publishers/anthropic',
    'watsonx': 'https://us-south.ml.cloud.ibm.com',
    'sap-ai-core': '',
}
VARIABLE_FIELDS = {
    'CLOUDFLARE_ACCOUNT_ID': 'accountId', 'CLOUDFLARE_GATEWAY_ID': 'gatewayId',
    'DATABRICKS_HOST': 'host', 'INFOMANIAK_PRODUCT_ID': 'productId',
    'NEON_AI_GATEWAY_BASE_URL': 'gatewayBaseURL', 'SNOWFLAKE_ACCOUNT': 'account',
    'GOOGLE_VERTEX_ENDPOINT': 'vertexEndpoint', 'GOOGLE_VERTEX_PROJECT': 'projectId',
    'GOOGLE_VERTEX_LOCATION': 'location', 'AWS_REGION': 'region',
    'AZURE_RESOURCE_NAME': 'resourceName', 'AZURE_COGNITIVE_SERVICES_RESOURCE_NAME': 'resourceName',
}
REST_OVERRIDES = {
    'aihubmix': 'https://docs.aihubmix.com/en/quick-start',
    'salad-cloud': 'https://docs.salad.com/ai-gateway/explanation/overview',
    'qvac': 'https://docs.qvac.tether.io/cli/http-server/',
    'cloudflare-ai-gateway': 'https://developers.cloudflare.com/ai-gateway/usage/chat-completion/',
}
LABELS = {
    'apiKey': 'API anahtarı / erişim belirteci', 'resourceName': 'Azure kaynak adı',
    'region': 'Bölge', 'projectId': 'Proje kimliği', 'location': 'Konum',
    'accountId': 'Hesap kimliği', 'gatewayId': 'Gateway kimliği',
    'host': 'Hesap sunucusu', 'productId': 'Ürün kimliği',
    'gatewayBaseURL': 'Gateway temel adresi', 'account': 'Snowflake hesap kimliği',
    'vertexEndpoint': 'Vertex API sunucusu',
    'deploymentName': 'Deployment adı (model adından farklıysa)',
    'spaceId': 'Alan kimliği (proje kimliği yerine)',
    'apiVersion': 'API sürümü', 'clientId': 'Client ID', 'clientSecret': 'Client secret',
    'tokenURL': 'OAuth belirteç adresi', 'deploymentId': 'Deployment kimliği',
    'resourceGroup': 'AI kaynak grubu', 'sapMode': 'SAP model bağlantısı',
}
SPECIAL_UNAVAILABLE = {
    'github-copilot': ('oauth', 'Copilot SDK yerel CLI/runtime bağlantısı ve ürüne ait abonelik giriş/kimlik akışı gerektirir; bu eklentide doğrulanmadı. GitHub Models ayrı bir API ürünüdür.'),
    'gitlab': ('oauth', 'Genel kullanıma açık doğrulanmış Duo bağlantısı yok; Chat REST API kurum/özellik kısıtlı, Agent Platform ayrı iş akışı ve kimlik adaptörü gerektirir.'),
    'v0': ('api-key', 'Güncel v0 API uygulama/Sandbox iş akışı kullanır; bu eklentinin tek metin düzeltme sözleşmesi için doğrulanmış adaptör yok.'),
}
POPULAR = {'openai', 'anthropic', 'google', 'openrouter', 'groq', 'deepseek', 'mistral', 'xai', 'amazon-bedrock', 'azure', 'google-vertex', 'vercel', 'opencode'}
NON_GENERATIVE = re.compile(r'embed|rerank|moderation|safeguard|(?:^|[/_-])(?:bge|e5|guard)(?:[/_-]|$)', re.I)
SPECIAL_FLOW = re.compile(r'(?:realtime|deep[- _]?research|search[- _]?preview|computer[- _]?use|(?:^|[/_ -])(?:tts|transcrib\w*|whisper|sora|veo|dall[- _]?e)(?:[/_ -]|$))', re.I)
OPENAI_RESPONSES_ONLY = re.compile(r'^(?:gpt-5(?:\.\d+)?-pro(?:-|$)|o[13]-pro(?:-|$)|gpt-5(?:\.\d+)?-codex|codex-mini)', re.I)


def normalize_url(value):
    if not value:
        return ''
    if not isinstance(value, str) or len(value) > 2048:
        raise ValueError('Geçersiz katalog adresi.')
    return re.sub(r'\$\{([A-Z0-9_]+)\}', lambda match: '{' + VARIABLE_FIELDS.get(match[1], match[1]) + '}', value).rstrip('/')


def valid_url(value, allow_templates=True):
    if not value:
        return False
    if allow_templates:
        value = value.replace('{gatewayBaseURL}', 'https://example.test')
        value = re.sub(r'\{[a-zA-Z0-9_]+\}', 'example', value)
    parsed = urlsplit(value)
    return bool(parsed.hostname) and not parsed.username and not parsed.password and not parsed.query and not parsed.fragment and (
        parsed.scheme == 'https' or parsed.scheme == 'http' and parsed.hostname in ('localhost', '127.0.0.1', '::1'))


def field(key, auth_type='api-key'):
    kind = 'password' if key in ('apiKey', 'clientSecret') else 'url' if key == 'tokenURL' else 'text'
    entry = {'key': key, 'label': LABELS.get(key, key), 'type': kind, 'required': True}
    if key == 'region':
        entry['default'] = 'us-east-1'
    elif key == 'location':
        entry['default'] = 'us-central1'
    elif key == 'apiKey' and auth_type == 'bearer':
        entry['label'] = 'Bearer erişim belirteci'
    return entry


def make_models(provider, provider_protocol):
    entries = []
    excluded = Counter()
    for identifier, model in sorted(provider.get('models', {}).items()):
        modalities = model.get('modalities', {})
        if 'text' not in modalities.get('input', []) or 'text' not in modalities.get('output', []):
            excluded['nonText'] += 1
            continue
        if NON_GENERATIVE.search(identifier + ' ' + model.get('name', '')):
            excluded['nonGenerative'] += 1
            continue
        item = {'id': identifier, 'name': model.get('name', identifier)}
        if set(modalities.get('output', [])) != {'text'} or SPECIAL_FLOW.search(identifier + ' ' + model.get('name', '')):
            item['selectable'] = False
            item['supportNote'] = 'Bu kayıt görsel/ses, gerçek zamanlı veya özel araç akışı içindir; bu eklentinin tek metin düzeltme isteğiyle kullanılmaz.'
        if model.get('temperature') is False:
            item['temperature'] = False
        if model.get('reasoning'):
            item['reasoning'] = True
        if model.get('structured_output'):
            item['structuredOutput'] = True
        if model.get('status'):
            item['status'] = model['status']
        for source, target in (('context', 'context'), ('output', 'output')):
            value = model.get('limit', {}).get(source)
            if isinstance(value, (int, float)) and value > 0:
                item[target] = value
        # Native auth/REST families own model transport; upstream SDK metadata must not bypass them.
        override = {} if provider.get('id') in ('cloudflare-ai-gateway', 'watsonx', 'sap-ai-core') else model.get('provider', {})
        if override.get('npm'):
            protocol = PROTOCOLS.get(override['npm'], 'unsupported')
            if protocol != provider_protocol:
                item['protocol'] = protocol
            if protocol == 'unsupported':
                item['selectable'] = False
                item['supportNote'] = 'Bu modele ait özel SDK/transport adaptörü uygulanmadı: ' + override['npm']
        if override.get('api'):
            item['baseURL'] = normalize_url(override['api'])
            if override.get('npm') == '@ai-sdk/amazon-bedrock/mantle':
                item['baseURL'] = item['baseURL'].replace('.api.aws/openai/v1', '.api.aws/v1')
                item['modelListPath'] = '/models'
                item['supportNote'] = 'Bedrock Mantle Responses yolu; Bedrock anahtarı, bölge ve bu API için model erişimi gerekir.'
            if provider.get('id') in ('azure', 'azure-cognitive-services') and item['baseURL'].endswith('.services.ai.azure.com/models'):
                item['baseURL'] = DEFAULT_URLS[provider['id']]
            if not valid_url(item['baseURL']):
                item['selectable'] = False
                item['supportNote'] = 'Modelin kaynak API adresi için desteklenen bir resolver gerekir.'
        if provider.get('id') == 'openai' and OPENAI_RESPONSES_ONLY.search(identifier):
            item['protocol'] = 'openai-responses'
            if item.get('selectable') is not False:
                item['supportNote'] = 'Responses API kullanılır; uzun düşünme süresi eklentinin bağlantı zaman aşımını aşabilir.'
        entries.append(item)
    return entries, excluded


def make_catalog(data, source_date, source_hash):
    if not isinstance(data, dict) or not data or len(data) > 2000:
        raise ValueError('Beklenen models.dev sağlayıcı haritası bulunamadı.')
    providers, excluded = [], Counter()
    for identifier, entry in sorted(data.items()):
        if not isinstance(entry, dict) or entry.get('id') != identifier or not isinstance(entry.get('models'), dict):
            raise ValueError('Sağlayıcı kimliği veya model haritası geçersiz.')
        npm = entry.get('npm', '')
        protocol = PROTOCOLS.get(npm, 'unsupported')
        if identifier in REST_OVERRIDES:
            protocol = 'openai-chat'
        if identifier == 'openai':
            protocol = 'openai-chat'
        base_url = DEFAULT_URLS.get(identifier, normalize_url(entry.get('api')))
        auth_type = 'api-key'
        notes = []
        selectable = protocol != 'unsupported' and valid_url(base_url)
        fields = [field('apiKey')]
        if base_url.startswith('http://'):
            auth_type = 'none'
            fields = []
            notes.append('Yerel servis çalışır durumda ve model yüklenmiş olmalı; yerel servisin erişim sınırlarını kullanıcı yönetir.')
        if identifier in ('google-vertex', 'google-vertex-anthropic'):
            auth_type = 'bearer'
            notes.append('Manuel ve süreli Google Cloud Bearer belirteci gerekir; ADC, servis hesabı ve OAuth yenilemesi eklentide yapılmaz.')
            fields = [field('apiKey', 'bearer')]
        if identifier == 'amazon-bedrock':
            auth_type = 'bearer'
            notes.append('Bedrock Bearer API anahtarı ve bölgesel model erişimi gerekir; AWS profil/IAM zinciri ve SigV4 bu yolun yerine geçmez.')
            fields = [field('apiKey', 'bearer')]
        if identifier == 'snowflake-cortex':
            auth_type = 'bearer'
            fields = [field('apiKey', 'bearer')]
            notes.append('Hesap kimliği ve Cortex yetkili PAT/JWT/OAuth Bearer belirteci gerekir; tarayıcı SSO veya token yenilemesi yapılmaz.')
        if identifier == 'watsonx':
            auth_type = 'iam'
            fields = [field('apiKey')]
            for key in ('projectId', 'spaceId', 'apiVersion'):
                descriptor = field(key, auth_type)
                descriptor['required'] = False
                if key == 'apiVersion':
                    descriptor['default'] = '2024-10-08'
                fields.append(descriptor)
            notes.append('IBM Cloud API anahtarı, doğru bölgesel servis adresi ve proje veya alan kimliği gerekir. Her işlemde IBM IAM üzerinden kısa ömürlü Bearer belirteci alınır; belirteç depolanmaz.')
        if identifier == 'sap-ai-core':
            auth_type = 'oauth-client-credentials'
            selectable = True
            fields = [field(key, auth_type) for key in ('clientId', 'clientSecret', 'tokenURL', 'deploymentId', 'resourceGroup')]
            descriptor = field('apiVersion', auth_type)
            descriptor['required'] = False
            descriptor['label'] = 'API sürümü (yalnız OpenAI deployment; boşsa modele göre)'
            fields.append(descriptor)
            fields.append({'key': 'sapMode', 'label': LABELS['sapMode'], 'type': 'select', 'required': False,
                           'default': 'orchestration', 'options': [
                               {'value': 'orchestration', 'label': 'Orkestrasyon (tüm model aileleri)'},
                               {'value': 'openai', 'label': 'OpenAI deployment'},
                           ]})
            notes.append('Servis anahtarındaki Client ID/secret, OAuth token adresi, AI API adresi, deployment ve kaynak grubu gerekir. Varsayılan Orchestration V2 farklı model aileleri için ortak metin yoludur; model erişimi hesabınıza bağlıdır. OpenAI deployment seçeneği yalnız o aileye ait deployment için kullanılır.')
        if identifier == 'cloudflare-ai-gateway':
            notes.append('Yalnız gateway üzerinde saklanmış BYOK anahtarı veya Unified Billing ile Cloudflare token yolu uygulanır. İstek başına ayrı upstream anahtarı gerektiren BYOK bu profilde uygulanmaz. Model ID provider/model biçimindedir. Belgelenen legacy compat yolu kullanılır; Cloudflare yeni REST bağlantıları için hesap AI/v1 yolunu önerir.')
        if identifier == 'salad-cloud':
            notes.append('Organizasyona ait AI Gateway anahtarı gerekir; Salad hesap API anahtarı ve Salad-Api-Key başlığı bu bağlantının yerine geçmez. Servis beta durumundadır.')
        if identifier == 'qvac':
            notes.append('QVAC HTTP sunucusu kullanıcı tarafından --openai ile başlatılmalı. Model ID, serve.models içindeki alias olmalı; katalogdaki SDK model adı otomatik olarak alias değildir.')
        if identifier in ('azure', 'azure-cognitive-services'):
            descriptor = field('deploymentName', auth_type)
            descriptor['required'] = False
            fields.append(descriptor)
            notes.append('Önce model ailesini seçin; Azure deployment adı katalogdaki model ID değerinden farklıysa Deployment adı alanına ayrıca yazın.')
        if identifier in SPECIAL_UNAVAILABLE:
            auth_type, note = SPECIAL_UNAVAILABLE[identifier]
            selectable = False
            notes.append(note)
        variable_keys = list(dict.fromkeys(re.findall(r'\{([a-zA-Z0-9_]+)\}', base_url)))
        fields.extend(field(key, auth_type) for key in variable_keys)
        models, model_exclusions = make_models(entry, protocol)
        excluded.update(model_exclusions)
        model_variable_keys = {key for model in models for key in re.findall(r'\{([a-zA-Z0-9_]+)\}', model.get('baseURL', ''))}
        for key in sorted(model_variable_keys.difference(variable_keys)):
            descriptor = field(key, auth_type)
            descriptor['required'] = False
            fields.append(descriptor)
        if not models:
            selectable = False
            notes.append('Bu kaynakta metin girdisinden metin üreten model bulunamadı.')
        provider = {
            'id': identifier, 'name': entry.get('name', identifier), 'baseURL': base_url,
            'protocol': protocol, 'authType': auth_type, 'docURL': entry.get('doc', ''),
            'npm': npm, 'env': entry.get('env', []), 'selectable': selectable,
            'status': 'protocol' if selectable else 'catalog', 'liveVerified': False,
            'popular': identifier in POPULAR, 'local': base_url.startswith('http://'),
            'fields': fields, 'models': models,
        }
        static_urls = [base_url] + [model.get('baseURL', '') for model in models]
        provider['origins'] = sorted({urlsplit(value).scheme + '://' + urlsplit(value).netloc + '/*'
                                      for value in static_urls if value and '{' not in value and valid_url(value, False)})
        if '{' in base_url:
            provider['baseURLTemplate'] = base_url
        if identifier in REST_OVERRIDES:
            provider['transportDocURL'] = REST_OVERRIDES[identifier]
        if identifier == 'cloudflare-ai-gateway':
            provider['authHeader'] = 'cf-aig-authorization'
        if identifier == 'qvac':
            provider['requiresManualModel'] = True
        if identifier == 'sap-ai-core':
            provider['usesAPIKey'] = False
            provider['requiresBaseURL'] = True
            provider['transportDocURL'] = 'https://help.sap.com/docs/sap-ai-core/sap-ai-core-service-guide/minimal-call-663f1b7795bf4472a436e4b865321498'
        if identifier == 'watsonx':
            provider['origins'].append('https://iam.cloud.ibm.com/*')
            provider['transportDocURL'] = 'https://cloud.ibm.com/apidocs/watsonx-ai#text-chat'
        if identifier in ('amazon-bedrock', 'snowflake-cortex', 'azure', 'azure-cognitive-services', 'google-vertex', 'google-vertex-anthropic', 'cloudflare-ai-gateway', 'watsonx', 'sap-ai-core'):
            provider['modelListPath'] = None
        if notes:
            provider['supportNote'] = ' '.join(notes)
        if identifier == 'openai':
            provider['defaultModel'] = 'gpt-4o'
            provider['authMethods'] = ['api-key', 'oauth']
            provider['authSupportNote'] = 'OpenAI API anahtarı gerekir; ChatGPT aboneliği bu API kullanımını karşılamaz.'
        if identifier == 'anthropic':
            provider['authSupportNote'] = 'Anthropic API anahtarı gerekir; Claude aboneliği bu API anahtarının yerine geçmez.'
        if identifier == 'amazon-bedrock':
            provider['authMethods'] = ['bearer', 'aws-sigv4']
        providers.append(provider)
    for identifier, name, base_url in [('ollama', 'Ollama (yerel)', 'http://127.0.0.1:11434/v1'),
                                        ('llamacpp', 'llama.cpp (yerel)', 'http://127.0.0.1:8080/v1')]:
        if identifier in data:
            continue
        providers.append({'id': identifier, 'name': name, 'baseURL': base_url, 'protocol': 'openai-chat',
                          'authType': 'none', 'docURL': 'https://opencode.ai/docs/providers/#' + ('ollama' if identifier == 'ollama' else 'llamacpp'),
                          'npm': '@ai-sdk/openai-compatible', 'env': [], 'selectable': True, 'status': 'protocol',
                          'liveVerified': False, 'popular': False, 'local': True, 'fields': [], 'models': [],
                          'origins': [base_url.split('/v1')[0] + '/*'], 'source': 'opencode-docs-local-example',
                          'supportNote': 'Katalog model ID sağlamaz; yerelde yüklenmiş modelin gerçek ID değerini girin. Yerel servis ve erişim izni gerekir.'})
    providers.sort(key=lambda entry: entry['id'])
    return {
        'schemaVersion': 1,
        'source': {'url': SOURCE_URL, 'fetchedOn': source_date, 'sha256': source_hash, 'license': 'MIT',
                   'licenseURL': LICENSE_URL, 'modelsRepositoryRevision': MODELS_REVISION,
                   'opencodeRepositoryRevision': OPENCODE_REVISION,
                   'opencodeDocs': 'https://opencode.ai/docs/providers/', 'opencodeV2Docs': 'https://opencode.ai/v2/docs/providers',
                   'note': 'API içerik SHA-256 ayrı anlık görüntüdür; depo revision ile yayın uç noktasının birebir eşitliği iddia edilmez.'},
        'default': {'providerId': 'openai', 'model': 'gpt-4o'},
        'stats': {'sourceProviders': len(data), 'providers': len(providers),
                  'sourceModels': sum(len(entry['models']) for entry in data.values()),
                  'textModels': sum(len(entry['models']) for entry in providers),
                  'selectableModelRecords': sum(model.get('selectable') is not False for entry in providers if entry['selectable'] for model in entry['models']),
                  'protocolProviders': sum(entry['selectable'] for entry in providers),
                  'protocolFamilies': dict(sorted(Counter(entry['protocol'] for entry in providers).items())),
                  'excludedModels': dict(excluded)},
        'providers': providers,
    }


def render(catalog):
    def encode(value):
        return json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
    metadata = {key: value for key, value in catalog.items() if key != 'providers'}
    prefix = encode(metadata)[:-1]
    records = ',\n'.join('    ' + encode(provider) for provider in catalog['providers'])
    return '/* models.dev verisinden yerel hazırlıkla üretilir. Uzak kod veya SDK yürütülmez.\n' + SOURCE_LICENSE + '\n*/\nconst PROVIDER_CATALOG = Object.freeze(' + prefix + ',"providers":[\n' + records + '\n]});\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'output/provider-research/models.dev-api.json')
    parser.add_argument('--source-date', required=True, help='Anlık görüntü tarihi: YYYY-MM-DD; tekrarlanabilir çıktı için açık verilir.')
    parser.add_argument('--expected-sha256', help='Yerel kaynağın beklenen SHA-256 değeri.')
    parser.add_argument('--download', action='store_true', help='Yalnız public metadata indirir; sağlayıcı API isteği veya SDK kurulumu yapmaz.')
    parser.add_argument('--check', action='store_true', help='Kaynakla mevcut çalışma kataloğunun eşitliğini doğrular; dosya değiştirmez.')
    parser.add_argument('--output', type=Path, default=ROOT / 'lib/provider-catalog.js')
    args = parser.parse_args()
    date.fromisoformat(args.source_date)
    if args.download:
        if args.check:
            parser.error('--check ile --download birlikte kullanılamaz.')
        with urlopen(Request(SOURCE_URL, headers={'User-Agent': 'duzelt-ai-catalog-updater/1.0'}), timeout=20) as response:
            payload = response.read(30_000_001)
        if len(payload) > 30_000_000:
            raise ValueError('Katalog kaynağı beklenen boyutu aşıyor.')
    else:
        payload = args.source.read_bytes()
    digest = hashlib.sha256(payload).hexdigest()
    if args.expected_sha256 and digest != args.expected_sha256:
        raise ValueError('Kaynak SHA-256 değeri beklenen anlık görüntüyle eşleşmiyor.')
    catalog = make_catalog(json.loads(payload), args.source_date, digest)
    output = render(catalog)
    if args.check:
        if args.output.read_text(encoding='utf-8') != output:
            raise ValueError('Çalışma kataloğu verilen kaynakla aynı değil.')
    else:
        if args.download:
            args.source.parent.mkdir(parents=True, exist_ok=True)
            temporary_source = args.source.with_suffix(args.source.suffix + '.tmp')
            temporary_source.write_bytes(payload)
            temporary_source.replace(args.source)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        temporary = args.output.with_suffix('.js.tmp')
        temporary.write_text(output, encoding='utf-8')
        temporary.replace(args.output)
    print(json.dumps({'sourceSha256': digest, 'stats': catalog['stats'], 'output': str(args.output), 'bytes': len(output.encode('utf-8')), 'check': args.check}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
