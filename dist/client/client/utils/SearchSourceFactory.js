import { tokenize } from "./tokenize";
import { smartQueries } from "./smartQueries";
import { sortSearchResults } from "./sortSearchResults";
import { processTreeStatusOfSearchResults } from "./processTreeStatusOfSearchResults";
import { language } from "./proxiedGenerated";
import lunr from "lunr";
export function SearchSourceFactory(
  wrappedIndexes,
  zhDictionary,
  resultsLimit,
  versions,
  activeVersion,
  latestVersion
) {
  return function searchSource(input, callback) {
    const rawTokens = tokenize(input, language);
    if (rawTokens.length === 0) {
      callback([]);
      return;
    }
    const queries = smartQueries(rawTokens, zhDictionary);
    const results = [];
    const versionToSearch =
      versions.length <= 1 ? undefined : activeVersion ?? latestVersion;
    search: for (const { term, tokens } of queries) {
      for (const { documents, index, type } of wrappedIndexes) {
        results.push(
          ...index
            .query((query) => {
              for (const item of term) {
                query.term(item.value, {
                  wildcard: item.wildcard,
                  presence: item.presence,
                });
              }
              if (versionToSearch) {
                // We want to search all documents with version = versionToSearch OR version = undefined
                // (blog posts and static pages have an undefined version)
                //
                // Since lunr.js does not allow OR queries, we instead prohibit all versions
                // except versionToSearch and undefined.
                //
                // https://github.com/cmfcmf/docusaurus-search-local/issues/19
                versions.forEach((version) => {
                  if (version.name !== versionToSearch.name) {
                    query.term(version.name, {
                      fields: ["v"],
                      boost: 0,
                      presence: lunr.Query.presence.PROHIBITED,
                    });
                  }
                });
              }
            })
            .filter((result) => result.score > 0)
            .slice(0, resultsLimit)
            // Remove duplicated results.
            .filter(
              (result) =>
                !results.some(
                  (item) => item.document.i.toString() === result.ref
                )
            )
            .slice(0, resultsLimit - results.length)
            .map((result) => {
              const document = documents.find(
                (doc) => doc.i.toString() === result.ref
              );
              return {
                document,
                type,
                page:
                  type !== 0 &&
                  wrappedIndexes[0].documents.find(
                    (doc) => doc.i === document.p
                  ),
                metadata: result.matchData.metadata,
                tokens,
                score: result.score,
              };
            })
        );
        if (results.length >= resultsLimit) {
          break search;
        }
      }
    }
    sortSearchResults(results);
    processTreeStatusOfSearchResults(results);
    callback(results);
  };
}
