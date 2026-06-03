import { NextResponse } from 'next/server';
const { syncRepo, listWikis, getWikiPageList } = require('@/lib/wiki');
const { indexPages, hasIndex } = require('@/lib/embeddings');

export async function POST() {
  try {
    syncRepo();

    // Re-index embeddings for wikis that already have an index
    // (only re-embeds changed pages thanks to content hashing)
    const wikis = listWikis();
    for (const wiki of wikis) {
      if (hasIndex(wiki.id)) {
        const pages = getWikiPageList(wiki.id, null);
        await indexPages(wiki.id, pages).catch(() => {});
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
