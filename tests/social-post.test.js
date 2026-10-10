import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSocialPost, cardShareUrl } from '../src/lib/socialPost.js';

test('social draft names two publishers and preserves reported details', () => {
 assert.equal(buildSocialPost({platform:['Google'], organization_publisher_named_in_deal_suit:['Der Spiegel','El País'], interaction:['Deal'], reported_details:'The update.'}), 'Google — deal with Der Spiegel and El País\n\nThe update.');
});
test('social draft counts distinct publishers for larger groups', () => {
 assert.equal(buildSocialPost({platform:['Google'], organization_publisher_named_in_deal_suit:['A','B','C','A'], interaction:['Deal'], reported_details:'Details'}), 'Google — deal with 3 news publishers\n\nDetails');
});
test('mixed interactions get a neutral title', () => {
 assert.equal(buildSocialPost({platform:['OpenAI'], organization_publisher_named_in_deal_suit:['Folha de S.Paulo'], interaction:['Lawsuit','Deal'], reported_details:'Update'}), 'OpenAI / Folha de S.Paulo — Lawsuit and Deal\n\nUpdate');
});

test('post includes a card permalink after the details', () => {
 const post = buildSocialPost({reported_details:'The update.'}, 'https://example.com/#card-42');
 assert.ok(post.endsWith('\n\nThe update.\n\nhttps://example.com/#card-42'));
});

test('card links stay on the current site and remove filters', () => {
 assert.equal(cardShareUrl('http://127.0.0.1:5175/?q=Google', 42), 'http://127.0.0.1:5175/#card-42');
 assert.equal(cardShareUrl('https://towcenter.github.io/deals-and-lawsuits-tracker/?platform=Google', 42), 'https://towcenter.github.io/deals-and-lawsuits-tracker/#card-42');
});
