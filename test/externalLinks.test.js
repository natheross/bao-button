import test from 'node:test';
import assert from 'node:assert/strict';
import { safeExternalUrl } from '../src/ui/externalLinks.js';
import { otherbutton } from '../src/config/otherbutton.js';

test('existing button-site links remain usable', () => {
    for (const item of otherbutton) {
        assert.equal(safeExternalUrl(item.url), item.url);
    }
});

test('untrusted schemes, credentials, and malformed URLs are rejected', () => {
    for (const url of [
        'javascript:alert(1)', 'data:text/html,hello', 'http://example.com/',
        'https://user:pass@example.com/', '/relative/path', 'https://',
        'https://example.com\njavascript:alert(1)',
    ]) {
        assert.equal(safeExternalUrl(url), null, url);
    }
});

test('valid HTTPS links keep their path and query when opened', () => {
    assert.equal(
        safeExternalUrl(' https://example.com/button?from=bao#top '),
        'https://example.com/button?from=bao#top'
    );
});
