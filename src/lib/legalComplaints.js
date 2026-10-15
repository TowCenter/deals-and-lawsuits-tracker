export const complaintCategories = [
 {name:'Copyright', claims:[
  'Copyright Infringement (17 U.S.C. § 501)',
  'Copyright Infringement (17 U.S.C. § 106)',
  'Copyright Infringement (non-US)',
  'Vicarious Copyright Infringement',
  'Contributory Copyright Infringement',
  'Circumvention of Technical Measures (17 U.S.C. 1201(A)(1))',
  'Removal of Copyright Management Information (17 U.S.C. § 1202)'
 ]},
 {name:'Trademark and Brand Protection', claims:[
  'Trademark Infringement (15 U.S.C. § 1114)',
  'Trademark Counterfeiting (15 U.S.C. § 1114, 1127)',
  'False Designation of Origin, Trademark Dilution (15 U.S.C. § 1125)',
  'Dilution and Injury to Business Reputation'
 ]},
 {name:'Antitrust and Monopolization', claims:[
  'Unlawful Monopolization (15 U.S.C. § 2)',
  'Monopolization or Attempted Monopolization (15 U.S.C. §§ 2, 3)',
  'Abuse of Dominant Position (15 U.S.C. §18)',
  'Illegal Tying (15 U.S.C. §§ 1, 3)',
  'Unlawful Agreement (15 U.S.C. §§ 1, 3)',
  'Reciprocal Dealing (15 U.S.C. § 1, 2)'
 ]},
 {name:'Unfair Competition and Equitable Claims', claims:[
  'Unfair Competition by Misappropriation',
  'Unfair Competition/Antitrust (non-US)',
  'Unjust Enrichment'
 ]}
];
const key = text => String(text).toLowerCase().replace(/[§\s.]/g,'').replace(/[–—]/g,'-');
export function groupLegalComplaints(claims) {
 const remaining = new Map(claims.map(claim => [key(claim),claim]));
 const groups = complaintCategories.map(category => ({name:category.name, claims:category.claims.flatMap(label => {
  const match=remaining.get(key(label));
  if (!match) return [];
  remaining.delete(key(label));
  return [match];
 })})).filter(group => group.claims.length);
 if (remaining.size) groups.push({name:'Other complaints',claims:[...remaining.values()]});
 return groups;
}
