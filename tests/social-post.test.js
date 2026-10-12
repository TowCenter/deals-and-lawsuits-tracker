import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSocialPost, cardShareUrl } from '../src/lib/socialPost.js';

const footer = ' -- @towcenter.bsky.social See more in the Deals and Disputes Tracker';

test('social draft uses the publisher-first deal formula without reported details', () => {
 assert.equal(buildSocialPost({platform:['Google'], organization_publisher_named_in_deal_suit:['Der Spiegel'], interaction:['Deal'], reported_details:'The update.'.repeat(100)}), `Der Spiegel signs deal with Google${footer}`);
});
test('social draft handles plural and distinct publishers', () => {
 assert.equal(buildSocialPost({platform:['Google'], organization_publisher_named_in_deal_suit:['A','B','C','A'], interaction:['Deal']}), `3 news publishers sign deals with Google${footer}`);
 assert.equal(buildSocialPost({platform:['Google'], organization_publisher_named_in_deal_suit:['A','B'], interaction:['Grant']}), `A and B receive grants from Google${footer}`);
});
test('lawsuits fall back to plaintiff and defendant names', () => {
 assert.equal(buildSocialPost({plaintiff:['Publisher'], defendant:['OpenAI'], interaction:['Lawsuit']}), `Publisher sues OpenAI${footer}`);
});
test('grants use the requested action', () => {
 assert.equal(buildSocialPost({organization_publisher_named_in_deal_suit:['Publisher'], platform:['OpenAI'], interaction:['Grant']}), `Publisher receives grant from OpenAI${footer}`);
});
test('mixed interactions retain each action', () => {
 assert.equal(buildSocialPost({platform:['OpenAI'], organization_publisher_named_in_deal_suit:['Folha de S.Paulo'], interaction:['Lawsuit','Deal']}), `Folha de S.Paulo sues OpenAI and signs deal with OpenAI${footer}`);
});
test('post includes the attribution and card permalink even without entity data', () => {
 assert.equal(buildSocialPost({reported_details:'The update.'}, 'https://example.com/#card-42'), `AI Deals and Disputes update${footer} https://example.com/#card-42`);
});

test('card links stay on the current site and remove filters', () => {
 assert.equal(cardShareUrl('http://127.0.0.1:5175/?q=Google', 42), 'http://127.0.0.1:5175/#card-42');
 assert.equal(cardShareUrl('https://towcenter.github.io/deals-and-lawsuits-tracker/?platform=Google', 42), 'https://towcenter.github.io/deals-and-lawsuits-tracker/#card-42');
});
