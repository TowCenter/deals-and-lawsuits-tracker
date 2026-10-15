import { parseArray } from './utils.js';

const names = value => [...new Set(parseArray(value).map(String).map(name => name.trim()).filter(name => name && name.toLowerCase() !== '(unknown)'))];
const joinNames = values => values.length === 2 ? values.join(' and ') : values.join(', ');

export function buildSocialPost(row, url = '', platform = 'bluesky') {
 const types = names(row.interaction).map(type => type.toLowerCase());
 const platforms = names(row.platform).length ? names(row.platform) : names(row.defendant);
 const publishers = names(row.organization_publisher_named_in_deal_suit).length ? names(row.organization_publisher_named_in_deal_suit) : names(row.plaintiff);
 const publisherTitle = publishers.length > 2 ? `${publishers.length} news publishers` : joinNames(publishers);
 const platformTitle = joinNames(platforms);
 const plural = publishers.length > 1;
 const actions = {
  deal: plural ? 'sign deals with' : 'signs deal with',
  lawsuit: plural ? 'sue' : 'sues',
  grant: plural ? 'receive grants from' : 'receives grant from'
 };
 const clauses = types.filter(type => actions[type]).map(type => `${actions[type]} ${platformTitle}`);
 const status = String(row.status || '').trim();
 const isStatusUpdate = types.includes('lawsuit') && status
  && !/^(filed|initiated(?:\s*\/\s*in progress)?)$/i.test(status);
 let title = publisherTitle && platformTitle && clauses.length
  ? `${publisherTitle} ${joinNames(clauses)}`
  : 'AI Deals and Disputes update';
 if (types.some(type => /^(collectives?|coalitions?)$/.test(type))) title = `${row.collective_name || 'Publisher coalition'} — membership update`;
 if (isStatusUpdate) {
  const parties = publisherTitle && platformTitle ? `${publisherTitle} vs ${platformTitle}` : 'Existing lawsuit';
  const otherActions = types.filter(type => type !== 'lawsuit' && actions[type])
   .map(type => `${publisherTitle} ${actions[type]} ${platformTitle}`);
  title = `Lawsuit update: ${parties} — ${status}`;
  if (publisherTitle && platformTitle && otherActions.length) title += `; ${joinNames(otherActions)}`;
 }
 const attribution = {bluesky: '@towcenter.bsky.social', x: '@TowCenter', linkedin: 'Tow Center for Digital Journalism'}[platform] || 'Tow Center for Digital Journalism';
 return `${title} -- ${attribution}\n\nSee more in the Deals and Disputes Tracker${url ? `\n${url}` : ''}`;
}

export function cardShareUrl(pageUrl, id) {
 const url = new URL(pageUrl);
 url.search = '';
 url.hash = `card-${encodeURIComponent(String(id))}`;
 return url.href;
}
