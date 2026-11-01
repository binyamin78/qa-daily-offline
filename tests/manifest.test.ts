// Guards the "no internet" promise: fails CI if a change would let the app reach the network.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8');
const manifest = read('android/app/src/main/AndroidManifest.xml');

const permissionTags = (name: string) =>
  [...manifest.matchAll(/<uses-permission\b[^>]*>/g)].map(m => m[0]).filter(tag => tag.includes(`"${name}"`));

describe('Android manifest', () => {
  it.each(['android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE', 'android.permission.ACCESS_WIFI_STATE'])(
    'strips %s, even when a library declares it',
    name => {
      const tags = permissionTags(name);
      expect(tags.length).toBeGreaterThan(0);
      tags.forEach(tag => expect(tag).toContain('tools:node="remove"'));
    },
  );

  it('turns off WebView Safe Browsing and metrics uploads', () => {
    expect(manifest).toMatch(/android\.webkit\.WebView\.EnableSafeBrowsing"\s+android:value="false"/);
    expect(manifest).toMatch(/android\.webkit\.WebView\.MetricsOptOut"\s+android:value="true"/);
  });

  it('keeps app data out of Google cloud backup', () => {
    expect(manifest).toContain('android:dataExtractionRules="@xml/data_extraction_rules"');
    expect(manifest).toContain('android:fullBackupContent="@xml/backup_rules"');
    const cloud = read('android/app/src/main/res/xml/data_extraction_rules.xml').match(/<cloud-backup>([\s\S]*?)<\/cloud-backup>/)?.[1] ?? '';
    const legacy = read('android/app/src/main/res/xml/backup_rules.xml');
    for (const domain of ['root', 'file', 'database', 'sharedpref', 'external']) {
      expect(cloud).toContain(`<exclude domain="${domain}" path="." />`);
      expect(legacy).toContain(`<exclude domain="${domain}" path="." />`);
    }
  });
});

describe('web bundle sources', () => {
  // Fonts and styles must be embedded: any external URL here would be fetched at runtime
  it.each(['index.html', 'index.css', 'fonts.css'])('%s loads nothing from the network', file => {
    const urls = read(file).match(/(?:src|href|url)\s*[=(]\s*["']?https?:\/\/[^"')\s]+/gi) ?? [];
    expect(urls).toEqual([]);
  });
});
