"""Prepare pinned public Quill assets and tracked fixture HTML; execute no package code."""
import base64
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import tarfile
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'output/store-first-correction-assets'
MANUAL = ROOT / 'output/manual-store-fixture'
FIXTURE = ROOT / 'tests/fixtures/store-first-correction.html'
REGISTRY_URL = 'https://registry.npmjs.org/quill/2.0.3'
TARBALL_URL = 'https://registry.npmjs.org/quill/-/quill-2.0.3.tgz'
EXPECTED_TARBALL_SHA256 = '3a8a6cb4383b65e93552ea3da79a796eb0be5d2ca08390f1add0208fb23e6f42'
EXPECTED_NPM_INTEGRITY = 'sha512-xEYQBqfYx/sfb33VJiKnSJp8ehloavImQ2A6564GAbqG55PGw1dAWUn1MUbQB62t0azawUS2CZZhWCjO8gRvTw=='
MEMBERS = {
    'package/dist/quill.js': 'dist/quill.js',
    'package/dist/quill.snow.css': 'dist/quill.snow.css',
    'package/LICENSE': 'LICENSE',
    'package/package.json': 'package.json'
}
EXPECTED_ASSET_SHA256 = {
    'dist/quill.js': 'f6157c72ac9b3f51cdead426335688a027b12405d9d6a4daadd38a676b2d7ff2',
    'dist/quill.snow.css': '1c7948cd13aa92fac6390319bc1e5e461823da171519d3a768db56164f871636',
    'LICENSE': '395c12b616d6f58238b4be39284d4d9221b58dd6e1f1e34d9ab537e34abbb022',
    'package.json': '9586857338fdcc6d2c083db2dd0475423de530feba2c040972b12d699846209d'
}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError('Public registry download unexpectedly redirected')


def download(url, limit):
    request = urllib.request.Request(url, headers={'User-Agent': 'duzelt-issue7-static-fixture-preparation'})
    with urllib.request.build_opener(NoRedirect()).open(request, timeout=30) as response:
        if response.status != 200 or response.url != url:
            raise RuntimeError('Unexpected public registry response')
        result = response.read(limit + 1)
    if len(result) > limit:
        raise RuntimeError('Public registry response exceeded the expected size limit')
    return result


def write_file(destination, data):
    # All names come from constants above. Also refuse pre-existing symlink paths.
    if not destination.is_relative_to(ROOT):
        raise RuntimeError('Fixture output must remain within the repository')
    for component in (destination, *destination.parents):
        if component == ROOT:
            break
        if component.is_symlink():
            raise RuntimeError('Fixture output cannot use a symbolic link: ' + str(component))
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)


def main():
    # Read the tracked HTML before downloading; preparation never edits its source.
    fixture_bytes = FIXTURE.read_bytes()
    metadata_bytes = download(REGISTRY_URL, 1024 * 1024)
    metadata = json.loads(metadata_bytes)
    if metadata['name'] != 'quill' or metadata['version'] != '2.0.3' or metadata['dist']['tarball'] != TARBALL_URL:
        raise RuntimeError('Registry metadata does not identify the expected upstream package')
    integrity = metadata['dist']['integrity']
    if integrity != EXPECTED_NPM_INTEGRITY:
        raise RuntimeError('Registry integrity differs from the pinned Quill 2.0.3 digest')
    archive_bytes = download(TARBALL_URL, 16 * 1024 * 1024)
    archive_sha256 = hashlib.sha256(archive_bytes).hexdigest()
    expected_sha512 = base64.b64decode(EXPECTED_NPM_INTEGRITY[len('sha512-'):], validate=True)
    if archive_sha256 != EXPECTED_TARBALL_SHA256 or hashlib.sha512(archive_bytes).digest() != expected_sha512:
        raise RuntimeError('Pinned registry tarball SHA-256/SHA-512 integrity mismatch')

    selected = {}
    with tarfile.open(fileobj=io.BytesIO(archive_bytes), mode='r:gz') as archive:
        members = archive.getmembers()
        for name, relative in MEMBERS.items():
            matches = [member for member in members if member.name == name]
            if len(matches) != 1 or not matches[0].isfile() or matches[0].size > 5 * 1024 * 1024:
                raise RuntimeError('Expected a unique bounded regular browser asset: ' + name)
            with archive.extractfile(matches[0]) as source:
                data = source.read(5 * 1024 * 1024 + 1)
            if len(data) != matches[0].size or hashlib.sha256(data).hexdigest() != EXPECTED_ASSET_SHA256[relative]:
                raise RuntimeError('Pinned asset content mismatch: ' + name)
            selected[relative] = data

    package = json.loads(selected['package.json'])
    if package['name'] != 'quill' or package['version'] != '2.0.3':
        raise RuntimeError('Extracted package metadata mismatch')

    write_file(OUTPUT / 'registry-quill-2.0.3.json', metadata_bytes)
    write_file(OUTPUT / 'quill-2.0.3.tgz', archive_bytes)
    asset_metadata = {}
    for relative, data in selected.items():
        for destination in (OUTPUT / 'vendor/quill' / relative, MANUAL / 'vendor/quill' / relative):
            write_file(destination, data)
        asset_metadata[relative] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    write_file(MANUAL / 'index.html', fixture_bytes)

    report = {
        'preparedAt': datetime.now(timezone.utc).isoformat(),
        'purpose': 'Preparation only; installed official Store extension runtime QA is recorded separately',
        'package': 'quill', 'version': '2.0.3', 'license': package.get('license'),
        'registryURL': REGISTRY_URL, 'tarballURL': TARBALL_URL,
        'registryMetadataSHA256': hashlib.sha256(metadata_bytes).hexdigest(),
        'npmIntegrity': integrity, 'npmIntegrityVerified': True,
        'pinnedTarballSHA256Verified': True, 'pinnedAssetSHA256Verified': True,
        'tarballBytes': len(archive_bytes), 'tarballSHA256': archive_sha256,
        'assets': asset_metadata,
        'fixtureSource': 'tests/fixtures/store-first-correction.html',
        'servedHTML': 'output/manual-store-fixture/index.html',
        'fixtureSHA256': hashlib.sha256(fixture_bytes).hexdigest(),
        'launchCommand': 'python3 tools/serve-store-fixture.py --port 8769',
        'url': 'http://127.0.0.1:8769/',
        'packageInstalled': False, 'lifecycleScriptsExecuted': False, 'downloadedCodeExecuted': False,
        'browserExecutedByPreparation': False, 'serverStartedByPreparation': False,
        'preparationProviderAPICalls': 0,
        'selection': list(MEMBERS),
        'extraction': 'Only exact allowlisted bounded regular files; no extractall, symbolic/hard links or arbitrary member paths.'
    }
    write_file(OUTPUT / 'asset-metadata.json', (json.dumps(report, indent=2) + '\n').encode())
    print(json.dumps({
        'package': 'quill@2.0.3', 'pinnedIntegrityVerified': True,
        'fixtureSHA256': report['fixtureSHA256'], 'assetCount': len(selected),
        'downloadedCodeExecuted': False, 'providerAPICallsByPreparation': 0
    }, indent=2))


if __name__ == '__main__':
    main()
