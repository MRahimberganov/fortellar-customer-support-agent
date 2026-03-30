import fs from "fs";
import path from "path";

export interface RAGSource {
  id: string;
  fileName: string;
  snippet: string;
  score: number;
}

type FortellarDoc = {
  id: string;
  fileName: string;
  title: string;
  content: string;
};

type RankedFortellarDoc = FortellarDoc & {
  score: number;
};

function loadFortellarDocs(): FortellarDoc[] {
  const docsDir = path.join(process.cwd(), "data", "fortellar");

  const files = fs.readdirSync(docsDir).filter((file) =>
    file.endsWith(".md")
  );

  return files.map((fileName) => {
    const fullPath = path.join(docsDir, fileName);
    const content = fs.readFileSync(fullPath, "utf8");

    const firstLine = content.split("\n")[0]?.replace(/^#\s*/, "").trim();

    return {
      id: fileName.replace(".md", ""),
      fileName,
      title: firstLine || fileName.replace(".md", ""),
      content,
    };
  });
}

function scoreDocument(query: string, content: string): number {
  const normalizedQuery = query.toLowerCase();
  const normalizedContent = content.toLowerCase();

  const queryTerms = normalizedQuery
    .replace(/[^\w\s&/-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  let score = 0;

  for (const term of queryTerms) {
    if (normalizedContent.includes(term)) {
      score += 1;
    }
  }

  if (
    normalizedQuery.includes("cloud") ||
    normalizedQuery.includes("cloudops") ||
    normalizedQuery.includes("terraform") ||
    normalizedQuery.includes("ci/cd") ||
    normalizedQuery.includes("infrastructure")
  ) {
    if (
      normalizedContent.includes("cloudops") ||
      normalizedContent.includes("terraform") ||
      normalizedContent.includes("ci/cd") ||
      normalizedContent.includes("infrastructure")
    ) {
      score += 3;
    }
  }

  if (
    normalizedQuery.includes("security") ||
    normalizedQuery.includes("compliance") ||
    normalizedQuery.includes("hipaa") ||
    normalizedQuery.includes("soc 2") ||
    normalizedQuery.includes("iam") ||
    normalizedQuery.includes("mfa")
  ) {
    if (
      normalizedContent.includes("security") ||
      normalizedContent.includes("compliance") ||
      normalizedContent.includes("hipaa") ||
      normalizedContent.includes("soc 2") ||
      normalizedContent.includes("iam") ||
      normalizedContent.includes("mfa")
    ) {
      score += 3;
    }
  }

  if (
    normalizedQuery.includes("disaster recovery") ||
    normalizedQuery.includes("recovery") ||
    normalizedQuery.includes("backup") ||
    normalizedQuery.includes("resilience") ||
    normalizedQuery.includes("business continuity")
  ) {
    if (
      normalizedContent.includes("disaster recovery") ||
      normalizedContent.includes("recovery") ||
      normalizedContent.includes("backup") ||
      normalizedContent.includes("resilience") ||
      normalizedContent.includes("business continuity")
    ) {
      score += 3;
    }
  }

  if (
    normalizedQuery.includes("ai") ||
    normalizedQuery.includes("artificial intelligence") ||
    normalizedQuery.includes("governance") ||
    normalizedQuery.includes("readiness")
  ) {
    if (
      normalizedContent.includes("ai") ||
      normalizedContent.includes("artificial intelligence") ||
      normalizedContent.includes("governance") ||
      normalizedContent.includes("readiness")
    ) {
      score += 3;
    }
  }

  return score;
}

export async function retrieveContext(
  query: string,
  knowledgeBaseId: string,
  n: number = 3,
): Promise<{
  context: string;
  isRagWorking: boolean;
  ragSources: RAGSource[];
}> {
  try {
    const docs = loadFortellarDocs();

    const rankedDocs: RankedFortellarDoc[] = docs
      .map((doc) => ({
        ...doc,
        score: scoreDocument(query, doc.content),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, n);

    const relevantDocs = rankedDocs.filter((doc) => doc.score > 0);

    const docsToUse: RankedFortellarDoc[] =
      relevantDocs.length > 0
        ? relevantDocs
        : docs.slice(0, 2).map((doc) => ({
            ...doc,
            score: 0,
          }));

    const context = docsToUse
      .map((doc) => `Source: ${doc.title}\n${doc.content}`)
      .join("\n\n---\n\n");

    const ragSources: RAGSource[] = docsToUse.map((doc) => ({
      id: doc.id,
      fileName: doc.fileName.replace(".md", ""),
      snippet: doc.content.slice(0, 220),
      score: doc.score,
    }));

    console.log("🔍 Local Fortellar RAG Sources:", ragSources);
    console.log("ℹ️ knowledgeBaseId received but not used:", knowledgeBaseId);

    return {
      context,
      isRagWorking: true,
      ragSources,
    };
  } catch (error) {
    console.error("RAG Error:", error);
    return {
      context: "",
      isRagWorking: false,
      ragSources: [],
    };
  }
}