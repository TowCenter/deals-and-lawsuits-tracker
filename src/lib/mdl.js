const orderUrl = 'https://www.jpml.uscourts.gov/sites/jpml/files/MDL-3143-Transfer_Order-3-25.pdf';
const ids = (row) => Array.isArray(row.Lawsuit_ID) ? row.Lawsuit_ID : row.Lawsuit_ID ? [row.Lawsuit_ID] : [];

/** Read explicit MDL membership and propagate it across updates of the same lawsuit. */
export function buildMdlMembership(rows) {
    const membership = new Map();
    for (const row of rows) {
        for (const mdl of Array.isArray(row.MDL) ? row.MDL : []) {
            const docket = String(mdl.MDL_Case_Number || '');
            const number = docket.match(/-md-0*(\d+)/i)?.[1];
            if (!number) continue;
            const joined = /consolidat|related action/i.test(String(row.Status || '') + ' ' + String(row['Reported Details'] || '')) ? row.Date : null;
            const details = {
                mdl_number: number,
                mdl_name: mdl.Name || mdl.MDL_Name || (number === '3143' ? 'In re: OpenAI, Inc., Copyright Infringement Litigation' : ''),
                mdl_court: mdl.Court || (number === '3143' ? 'Southern District of New York' : ''),
                mdl_docket: docket,
                mdl_docket_url: mdl.Docket || (number === '3143' ? 'https://www.courtlistener.com/docket/69879510/in-re-openai-inc-copyright-infringement-litigation/' : null),
                mdl_initiated_date: mdl['Date Initiated'] || null,
                mdl_joined_date: joined,
                mdl_source: mdl.Source || (number === '3143' && joined === '2025-04-03' ? orderUrl : null),
            };
            for (const id of ids(row)) {
                const previous = membership.get(id);
                if (!previous || (joined && (!previous.mdl_joined_date || joined < previous.mdl_joined_date))) {
                    membership.set(id, details);
                }
            }
        }
    }
    return (row) => ids(row).map(id => membership.get(id)).find(Boolean) || {};
}

export function isMdlConsolidation(row) {
    return /^consolidated into multi[- ]district litigation$/i.test(String(row.status || '').trim());
}
