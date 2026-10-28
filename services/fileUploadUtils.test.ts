import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMaxUploadMb,
  formatFileSize,
  estimateDataUrlDecodedBytes,
  validateFileSize,
  calculateStorageAnalytics
} from './fileUploadUtils';

test('normalizeMaxUploadMb clamps and defaults properly', () => {
  assert.equal(normalizeMaxUploadMb(undefined), 50);
  assert.equal(normalizeMaxUploadMb(0), 50);
  assert.equal(normalizeMaxUploadMb(25), 25);
  assert.equal(normalizeMaxUploadMb(900), 500);
});

test('calculateStorageAnalytics returns empty stats when no uploads exist', () => {
  const summary = calculateStorageAnalytics({
    users: {
      u1: { id: 'u1', username: 'ali', displayName: 'علی', avatar: 'data:image/svg+xml;utf8,<svg></svg>' }
    },
    chats: {},
    stories: {}
  });

  assert.equal(summary.totalBytes, 0);
  assert.equal(summary.totalFilesCount, 0);
  assert.equal(summary.uploadingUsersCount, 0);
  assert.equal(summary.topUsers.length, 0);
  assert.equal(summary.categories.length, 5);
  for (const cat of summary.categories) {
    assert.equal(cat.bytes, 0);
    assert.equal(cat.barHeightPercent, 0);
  }
});

test('calculateStorageAnalytics aggregates categories and ranks top 5 users accurately', () => {
  // Create base64 payloads of known decoded sizes
  const makeBase64 = (byteLen: number) => {
    const buf = Buffer.alloc(byteLen, 65);
    return `data:application/octet-stream;base64,${buf.toString('base64')}`;
  };

  const users = [
    { id: 'u1', username: 'user1', displayName: 'کاربر اول', avatar: makeBase64(1024) }, // 1 KB avatar
    { id: 'u2', username: 'user2', displayName: 'کاربر دوم' },
    { id: 'u3', username: 'user3', displayName: 'کاربر سوم' },
    { id: 'u4', username: 'user4', displayName: 'کاربر چهارم' },
    { id: 'u5', username: 'user5', displayName: 'کاربر پنجم' },
    { id: 'u6', username: 'user6', displayName: 'کاربر ششم' }
  ];

  const chats = [
    {
      id: 'c1',
      type: 'group',
      messages: [
        { id: 'm1', senderId: 'u2', fileSize: 50000, fileName: 'report.pdf' }, // 50,000 B file
        { id: 'm2', senderId: 'u3', imageUrl: makeBase64(30000) }, // 30,000 B image
        { id: 'm3', senderId: 'u4', audioUrl: makeBase64(20000) }, // 20,000 B audio
        { id: 'm4', senderId: 'u5', fileSize: 10000, fileName: 'notes.txt' }, // 10,000 B file
        { id: 'm5', senderId: 'u6', fileSize: 500, fileName: 'tiny.txt' } // 500 B file
      ]
    }
  ];

  const stories = [
    { id: 's1', userId: 'u1', userName: 'کاربر اول', mediaUrl: makeBase64(40000) } // 40,000 B story -> u1 total = 41,024 B
  ];

  const result = calculateStorageAnalytics({ users, chats, stories });

  // Total bytes = 1024 (avatar) + 50000 + 10000 + 500 (files) + 30000 (images) + 20000 (audio) + 40000 (stories) = 151524
  assert.equal(result.totalBytes, 151524);
  assert.equal(result.totalFilesCount, 7);
  assert.equal(result.uploadingUsersCount, 6);

  // Top 5 users should exclude u6 (lowest with 500 B) and order u2, u1, u3, u4, u5
  assert.equal(result.topUsers.length, 5);
  assert.deepEqual(
    result.topUsers.map((u) => u.userId),
    ['u2', 'u1', 'u3', 'u4', 'u5']
  );
  assert.equal(result.topUsers[0].totalBytes, 50000);
  assert.equal(result.topUsers[1].totalBytes, 41024);
  assert.equal(result.topUsers[1].fileCount, 2);

  // Category checks
  const filesCat = result.categories.find((c) => c.key === 'files')!;
  const storiesCat = result.categories.find((c) => c.key === 'stories')!;
  assert.equal(filesCat.bytes, 60500);
  assert.equal(filesCat.fileCount, 3);
  assert.equal(filesCat.barHeightPercent, 100); // Highest category
  assert.equal(storiesCat.bytes, 40000);
  assert.equal(storiesCat.fileCount, 1);
});

test('validateFileSize enforces maxUploadSizeMb', () => {
  const ok = validateFileSize(10 * 1024 * 1024, 50);
  assert.equal(ok.valid, true);
  const bad = validateFileSize(60 * 1024 * 1024, 50);
  assert.equal(bad.valid, false);
  assert.ok(bad.message?.includes('50'));
});
