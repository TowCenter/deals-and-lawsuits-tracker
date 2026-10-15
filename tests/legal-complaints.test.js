import test from 'node:test';
import assert from 'node:assert/strict';
import {groupLegalComplaints,complaintCategories} from '../src/lib/legalComplaints.js';
test('all supplied complaints follow the requested category and claim order',()=>{
 const claims=complaintCategories.flatMap(group=>group.claims);
 assert.deepEqual(groupLegalComplaints([...claims].reverse()),complaintCategories);
});
test('minor citation spacing is tolerated and unmatched complaints are preserved',()=>{
 assert.deepEqual(groupLegalComplaints(['New claim','Abuse of Dominant Position (15 U.S.C. § 18)']),[
  {name:'Antitrust and Monopolization',claims:['Abuse of Dominant Position (15 U.S.C. § 18)']},
  {name:'Other complaints',claims:['New claim']}
 ]);
 assert.deepEqual(groupLegalComplaints([]),[]);
});
