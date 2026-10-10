// OpenFEMA DisasterDeclarationsSummaries v2, Miami-Dade.
import { cachedJson } from '../cache.js';

export async function femaDeclarations(top = 10) {
  const filter = encodeURIComponent("state eq 'FL' and designatedArea eq 'Miami-Dade (County)'");
  const select = 'disasterNumber,declarationType,declarationDate,incidentType,declarationTitle,incidentBeginDate,incidentEndDate,designatedArea,ihProgramDeclared,iaProgramDeclared';
  const url =
    `https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$filter=${filter}` +
    `&$orderby=${encodeURIComponent('declarationDate desc')}&$top=${top}&$select=${select}`;
  const r = await cachedJson<any>(url, { ttlMs: 6 * 3600_000 });
  const rows: any[] = r.body?.DisasterDeclarationsSummaries || [];
  return {
    declarations: rows.map((d) => ({
      number: d.disasterNumber,
      title: d.declarationTitle,
      date: d.declarationDate,
      type: d.declarationType,
      incidentType: d.incidentType,
      incidentBeginDate: d.incidentBeginDate,
      incidentEndDate: d.incidentEndDate,
      iaProgramDeclared: d.iaProgramDeclared,
      ihProgramDeclared: d.ihProgramDeclared,
    })),
    fetchedAt: r.fetchedAt,
    _source: 'OpenFEMA DisasterDeclarationsSummaries v2 (fema.gov/api/open/v2)',
  };
}
