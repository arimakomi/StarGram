import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterChatsAndMessages, buildMessageSnippet } from './searchUtils';
import { Chat, User } from '../types';

const currentUser: User = {
  id: 'u1',
  username: 'artin',
  displayName: 'آرتین',
  avatar: '',
  status: 'online',
  theme: 'night',
  wallpaper: 'default',
  privacy: { showStatus: 'all', showAvatar: 'all' },
};

const otherUser: User = {
  id: 'u2',
  username: 'sara_dev',
  displayName: 'سارا محمدی',
  avatar: '',
  status: 'online',
  phone: '09121112233',
  theme: 'night',
  wallpaper: 'default',
  privacy: { showStatus: 'all', showAvatar: 'all' },
};

const sampleChats: Chat[] = [
  {
    id: 'c_private_1',
    type: 'private',
    participants: [currentUser, otherUser],
    participantIds: ['u1', 'u2'],
    pinnedMessageIds: [],
    unreadCount: 1,
    messages: [
      {
        id: 'm1',
        senderId: 'u2',
        text: 'سلام آرتین، فایل گزارش پروژه آماده شد.',
        timestamp: 1000,
      },
      {
        id: 'm2',
        senderId: 'u1',
        text: 'ممنون سارا، الان بررسی می‌کنم.',
        timestamp: 2000,
      },
    ],
    lastMessage: {
      id: 'm2',
      senderId: 'u1',
      text: 'ممنون سارا، الان بررسی می‌کنم.',
      timestamp: 2000,
    },
  },
  {
    id: 'c_group_1',
    type: 'group',
    groupName: 'تیم فنی استارلی',
    publicHandle: 'starly_devs',
    description: 'هماهنگی توسعه و انتشار نسخه جدید',
    participants: [currentUser, otherUser],
    participantIds: ['u1', 'u2'],
    pinnedMessageIds: [],
    unreadCount: 0,
    messages: [
      {
        id: 'm3',
        senderId: 'u1',
        text: 'جلسه بررسی امنیت ساعت ۱۴ برگزار می‌شود.',
        timestamp: 3000,
      },
    ],
    lastMessage: {
      id: 'm3',
      senderId: 'u1',
      text: 'جلسه بررسی امنیت ساعت ۱۴ برگزار می‌شود.',
      timestamp: 3000,
    },
  },
];

test('filterChatsAndMessages matches chats by displayName, username, groupName, and handle', () => {
  const byName = filterChatsAndMessages(sampleChats, 'سارا', currentUser);
  assert.equal(byName.matchedChats.length, 1);
  assert.equal(byName.matchedChats[0].id, 'c_private_1');

  const byHandle = filterChatsAndMessages(sampleChats, '@starly_devs', currentUser);
  assert.equal(byHandle.matchedChats.length, 1);
  assert.equal(byHandle.matchedChats[0].id, 'c_group_1');
});

test('filterChatsAndMessages finds matching messages across chats and normalizes Persian digits', () => {
  const byMsg = filterChatsAndMessages(sampleChats, 'گزارش پروژه', currentUser);
  assert.equal(byMsg.matchedMessages.length, 1);
  assert.equal(byMsg.matchedMessages[0].message.id, 'm1');
  assert.equal(byMsg.matchedMessages[0].chat.id, 'c_private_1');
  assert.equal(byMsg.matchedMessages[0].senderName, 'سارا محمدی');

  const byPersianNumber = filterChatsAndMessages(sampleChats, '14', currentUser);
  assert.equal(byPersianNumber.matchedMessages.length, 1);
  assert.equal(byPersianNumber.matchedMessages[0].message.id, 'm3');
});

test('filterChatsAndMessages respects clearedAt history timestamp per user', () => {
  const clearedChats: Chat[] = [
    {
      ...sampleChats[0],
      clearedAt: { u1: 1500 },
    },
  ];
  const res = filterChatsAndMessages(clearedChats, 'گزارش پروژه', currentUser);
  assert.equal(res.matchedMessages.length, 0);
});

test('buildMessageSnippet creates compact snippet around match', () => {
  const longText = 'این یک متن بسیار طولانی برای تست عملکرد خلاصه‌سازی پیام در بخش جستجوی سراسری سایدبار است که کلمه کلیدی ویژه را در میانه خود دارد و ادامه می‌یابد.';
  const { snippet } = buildMessageSnippet(longText, 'کلیدی ویژه', 50);
  assert.equal(snippet.includes('کلیدی ویژه'), true);
  assert.equal(snippet.length <= 54, true);
});
