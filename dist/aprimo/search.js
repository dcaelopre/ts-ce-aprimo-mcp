function extractThumbnailUrl(record) {
    return (record.thumbnail?.uri ??
        record.thumbnail?.href ??
        record._links?.thumbnail?.href ??
        null);
}
function mapRecord(record) {
    return {
        id: record.id ?? "",
        title: record.title ?? null,
        status: record.status ?? null,
        thumbnailUrl: extractThumbnailUrl(record),
    };
}
function escapeAprimoSearchLiteral(value) {
    return value.replace(/'/g, "''");
}
function buildKeywordSearchExpression(query, searchFields) {
    const term = escapeAprimoSearchLiteral(query.trim());
    const clauses = searchFields.map((field) => `${field} CONTAINS '${term}'`);
    return {
        expression: clauses.join(" OR "),
    };
}
export async function searchRecords(client, config, params) {
    const trimmedQuery = params.query.trim();
    if (!trimmedQuery) {
        throw new Error("Search query cannot be empty");
    }
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    const queryString = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
    }).toString();
    const data = await client.post(`/api/core/search/records?${queryString}`, {
        searchExpression: buildKeywordSearchExpression(trimmedQuery, config.searchFields),
    }, { "select-record": "title,thumbnail,status" });
    const rawRecords = data.items ??
        data._embedded?.records ??
        data._embedded?.items ??
        [];
    return {
        page: data.page ?? page,
        pageSize: data.pageSize ?? pageSize,
        totalCount: data.totalCount ?? null,
        records: rawRecords.map(mapRecord).filter((record) => record.id),
    };
}
