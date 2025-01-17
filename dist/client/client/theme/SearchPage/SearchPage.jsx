import React, { useCallback, useEffect, useMemo, useState } from "react";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import {
  useActiveVersion,
  useLatestVersion,
  useVersions,
} from "@theme/hooks/useDocs";
import Head from "@docusaurus/Head";
import Link from "@docusaurus/Link";
import useSearchQuery from "../hooks/useSearchQuery";
import { fetchIndexes } from "../SearchBar/fetchIndexes";
import { SearchSourceFactory } from "../../utils/SearchSourceFactory";
import { highlight } from "../../utils/highlight";
import { highlightStemmed } from "../../utils/highlightStemmed";
import { getStemmedPositions } from "../../utils/getStemmedPositions";
import LoadingRing from "../LoadingRing/LoadingRing";
import { translations } from "../../utils/proxiedGenerated";
import { simpleTemplate } from "../../utils/simpleTemplate";
import styles from "./SearchPage.module.css";
export default function SearchPage() {
  const {
    siteConfig: { baseUrl },
  } = useDocusaurusContext();
  const { searchValue, updateSearchPath } = useSearchQuery();
  const [searchQuery, setSearchQuery] = useState(searchValue);
  const [searchSource, setSearchSource] = useState();
  const [searchResults, setSearchResults] = useState();
  const pageTitle = useMemo(
    () =>
      searchQuery
        ? simpleTemplate(translations.search_results_for, {
            keyword: searchQuery,
          })
        : translations.search_the_documentation,
    [searchQuery]
  );
  useEffect(() => {
    updateSearchPath(searchQuery);
    if (searchSource) {
      if (searchQuery) {
        searchSource(searchQuery, (results) => {
          setSearchResults(results);
        });
      } else {
        setSearchResults(undefined);
      }
    }
    // `updateSearchPath` should not be in the deps,
    // otherwise will cause call stack overflow.
  }, [searchQuery, searchSource]);
  const handleSearchInputChange = useCallback((e) => {
    setSearchQuery(e.target.value);
  }, []);
  useEffect(() => {
    if (searchValue && searchValue !== searchQuery) {
      setSearchQuery(searchValue);
    }
  }, [searchValue]);
  const versions = useVersions();
  const activeVersion = useActiveVersion();
  const latestVersion = useLatestVersion();
  useEffect(() => {
    async function doFetchIndexes() {
      const { wrappedIndexes, zhDictionary } = await fetchIndexes(baseUrl);
      setSearchSource(() =>
        SearchSourceFactory(
          wrappedIndexes,
          zhDictionary,
          100,
          versions,
          activeVersion,
          latestVersion
        )
      );
    }
    doFetchIndexes();
  }, [baseUrl]);
  return (
    <Layout title={pageTitle}>
      <Head>
        <meta property="robots" content="noindex, follow" />
      </Head>

      <div className="container margin-vert--lg">
        <h1>{pageTitle}</h1>

        <input
          type="search"
          name="q"
          className={styles.searchQueryInput}
          aria-label="Search"
          onChange={handleSearchInputChange}
          value={searchQuery}
          autoComplete="off"
          autoFocus
        />

        {!searchSource && searchQuery && (
          <div>
            <LoadingRing />
          </div>
        )}

        {searchResults &&
          (searchResults.length > 0 ? (
            <p>
              {simpleTemplate(
                searchResults.length === 1
                  ? translations.count_documents_found
                  : translations.count_documents_found_plural,
                {
                  count: searchResults.length,
                }
              )}
            </p>
          ) : process.env.NODE_ENV === "production" ? (
            <p>{translations.no_documents_were_found}</p>
          ) : (
            <p>
              ⚠️ The search index is only available when you run docusaurus
              build!
            </p>
          ))}

        <section>
          {searchResults &&
            searchResults.map((item) => (
              <SearchResultItem key={item.document.i} searchResult={item} />
            ))}
        </section>
      </div>
    </Layout>
  );
}
function SearchResultItem({
  searchResult: { document, type, page, tokens, metadata },
}) {
  const isTitle = type === 0;
  const isContent = type === 2;
  const pathItems = (isTitle ? document.b : page.b).slice();
  const articleTitle = isContent ? document.s : document.t;
  if (!isTitle) {
    pathItems.push(page.t);
  }
  return (
    <article className={styles.searchResultItem}>
      <h2>
        <Link
          to={document.u + (document.h || "")}
          dangerouslySetInnerHTML={{
            __html: isContent
              ? highlight(articleTitle, tokens)
              : highlightStemmed(
                  articleTitle,
                  getStemmedPositions(metadata, "t"),
                  tokens,
                  100
                ),
          }}
        />
      </h2>
      {pathItems.length > 0 && (
        <p className={styles.searchResultItemPath}>{pathItems.join(" › ")}</p>
      )}
      {isContent && (
        <p
          className={styles.searchResultItemSummary}
          dangerouslySetInnerHTML={{
            __html: highlightStemmed(
              document.t,
              getStemmedPositions(metadata, "t"),
              tokens,
              100
            ),
          }}
        />
      )}
    </article>
  );
}
