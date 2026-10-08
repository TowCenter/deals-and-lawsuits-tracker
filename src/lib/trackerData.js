import { buildMdlMembership } from './mdl.js';

// Helper function to check if value is NaN or empty
function isValidValue(value) {
    if (value === null || value === undefined) return false;
    // Handle NaN (can be literal NaN or string "NaN")
    if (typeof value === 'number' && isNaN(value)) return false;
    if (value === 'NaN' || value === 'nan' || (typeof value === 'string' && value.toLowerCase() === 'nan')) return false;
    // Handle Infinity
    if (value === Infinity || value === -Infinity) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
}

// Helper function to normalize array fields
function normalizeArray(value) {
    if (!isValidValue(value)) return [];
    if (Array.isArray(value)) return value.filter(v => isValidValue(v));
    return [value].filter(v => isValidValue(v));
}

// Helper function to normalize map fields (publication -> countries, country -> flag)
function normalizeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

/** Normalize raw tracker records into the shared card, filter and network data model. */
export function normalizeData(rawDataArray) {
    if (!Array.isArray(rawDataArray)) {
        console.error('rawDataArray is not an array:', rawDataArray);
        return [];
    }
    
    const mdlForRow = buildMdlMembership(rawDataArray);
    return rawDataArray.map((row, index) => {
        try {
            // Normalize linked_entry_ids - handle both array and null/undefined.
            // This is the curated link set; related_ids fans out to the whole
            // cluster and is not what the tray shows.
            let linkedEntryIds = null;
            if (row?.linked_entry_ids !== null && row?.linked_entry_ids !== undefined) {
                if (Array.isArray(row.linked_entry_ids)) {
                    linkedEntryIds = row.linked_entry_ids.filter(id => id != null);
                } else if (typeof row.linked_entry_ids === 'string') {
                    // Handle comma-separated string
                    linkedEntryIds = row.linked_entry_ids.split(',').map(id => {
                        const num = parseInt(id.trim(), 10);
                        return isNaN(num) ? null : num;
                    }).filter(id => id != null);
                } else {
                    const num = parseInt(row.linked_entry_ids, 10);
                    linkedEntryIds = isNaN(num) ? null : [num];
                }
                if (linkedEntryIds && linkedEntryIds.length === 0) {
                    linkedEntryIds = null;
                }
            }
            
            const interaction = normalizeArray(row?.Interaction);
            const grantees = normalizeArray(row?.Grantees);
            const affectedPublications = normalizeArray(row?.['Affected Publications']);
            const namedOrganizations = normalizeArray(row?.['News Org(s)']);
            // Grant beneficiaries are explicit participants, not ownership descendants.
            const publishers = interaction.some(value => String(value).toLowerCase() === 'grant')
                ? [...new Set([...namedOrganizations, ...grantees, ...affectedPublications])]
                : namedOrganizations;

            return {
                id: row?.id != null ? row.id : index, // Use row.id if available, otherwise use index
                date: row?.Date || null,
                interaction,
                platform: normalizeArray(row?.['AI Company']),
                publishers,
                type: normalizeArray(row?.Type),
                reported_details: row?.['Reported Details'] || '',
                organization_publisher_named_in_deal_suit: publishers,
                grantees,
                named_organizations: namedOrganizations,
                affected_publications: affectedPublications,
                parent_child_matches: Array.isArray(row?.['parent_child_matches']) ? row['parent_child_matches'] : [],
                docket: row?.Docket || null,
                additional_coverage: row?.['Additional Coverage'] || null,
                sources: normalizeArray(row?.Sources),
                linked_entry_ids: linkedEntryIds,
                ...mdlForRow(row),
                // Lawsuit-specific fields
                // Rows sharing a lawsuit_id are the SAME case at different points in time,
                // not related cases. CardView merges them into one card with a status track.
                lawsuit_ids: normalizeArray(row?.Lawsuit_ID),
                lawsuit_id: isValidValue(row?.Lawsuit_ID) ? String(row.Lawsuit_ID) : null,
                status: isValidValue(row?.Status) ? String(row.Status) : null,
                case_number: isValidValue(row?.['Case Number']) ? String(row['Case Number']) : null,
                defendant: normalizeArray(row?.Defendant),
                plaintiff: normalizeArray(row?.Plaintiff),
                case_filing: isValidValue(row?.['Case Filing']) ? String(row['Case Filing']) : null,
                location: isValidValue(row?.Location) ? String(row.Location) : null,
                // Publication -> countries, and country -> flag emoji, for the
                // flags shown beside publications and the Location filter
                publication_countries: normalizeObject(row?.['Publication Countries']),
                country_flags: normalizeObject(row?.['Country Flags']),
            };
        } catch (error) {
            console.error(`Error processing row ${index}:`, error, row);
            return null;
        }
    }).filter(row => row !== null);
}

