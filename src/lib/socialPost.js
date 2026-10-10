import { parseArray } from './utils.js';

const names = value => [...new Set(parseArray(value).map(String).map(name => name.trim()).filter(name => name && name.toLowerCase() !== '(unknown)'))];
const joinNames = values => values.length === 2 ? values.join(' and ') : values.join(', ');

export function buildSocialPost(row, url = '') {
 const types = names(row.interaction).map(type => type.toLowerCase());
 const platforms = names(row.platform).length ? names(row.platform) : names(row.defendant);
 const publishers = names(row.organization_publisher_named_in_deal_suit).length ? names(row.organization_publisher_named_in_deal_suit) : names(row.plaintiff);
 const publisherTitle = publishers.length > 2 ? `${publishers.length} news publishers` : joinNames(publishers);
 const platformTitle = joinNames(platforms);
 let title;
 if (types.length === 1 && types[0] === 'deal' && platformTitle && publisherTitle) {
  title = `${platformTitle} — deal with ${publisherTitle}`;
 } else {
  const entities = [platformTitle, publisherTitle].filter(Boolean).join(' / ');
  const interaction = types.map(type => type.charAt(0).toUpperCase() + type.slice(1)).join(' and ');
  title = [entities, interaction].filter(Boolean).join(' — ') || 'AI Deals and Disputes update';
 }
 return `${title}\n\n${String(row.reported_details || '').trim()}${url ? `\n\n${url}` : ''}`;
}

export function cardShareUrl(pageUrl, id) {
 const url = new URL(pageUrl);
 url.search = '';
 url.hash = `card-${encodeURIComponent(String(id))}`;
 return url.href;
}
