"use strict";

/* =========================================================
   Book Finder — Google Books edition
   - One search bar: everything / title / author / genre
   - Popular shelf: NYT Best Sellers (with NYT key) or a
     weekly rotating Google Books spotlight (no extra key)
   - Favorites with reading status + custom categories
   - Storage: Supabase database when configured & signed in,
     otherwise the browser's localStorage
   ========================================================= */

const CONFIG = window.BOOK_FINDER_CONFIG || {};

function cleanKey(value) {
    const key = String(value || "").trim();
    return key && !key.startsWith("PASTE") ? key : "";
}

const GOOGLE_KEY = cleanKey(CONFIG.GOOGLE_BOOKS_API_KEY);
const NYT_KEY = cleanKey(CONFIG.NYT_API_KEY);

const GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes";

const STATUSES = ["Want to Read", "Reading", "Completed", "On Hold"];
const DEFAULT_CATEGORIES = ["Classics", "Comfort Reads", "For School"];
const UNCATEGORIZED = "__none__";
const NEW_CATEGORY = "__new__";

const LS_FAVORITES = "bookFavorites";
const LS_CATEGORIES = "bookCategories";

const PAGE_SIZE = 24;
const HOUR = 60 * 60 * 1000;

const POPULAR_LISTS = [
    { id: "hardcover-fiction", label: "Fiction" },
    { id: "hardcover-nonfiction", label: "Nonfiction" },
    { id: "young-adult-hardcover", label: "Young Adult" }
];

const SPOTLIGHT_GENRES = [
    "Fantasy", "Mystery", "Romance", "Science Fiction",
    "Thriller", "Historical Fiction", "Horror", "Poetry",
    "Biography", "Adventure", "Philosophy", "Young Adult Fiction"
];

const $ = id => document.getElementById(id);


/* =========================================================
   Small helpers
   ========================================================= */

function readJSON(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key));
        return value === null || value === undefined ? fallback : value;
    } catch {
        return fallback;
    }
}

function writeJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn("Could not save to localStorage", error);
    }
}

function cacheGet(key, maxAge) {
    const cached = readJSON(key, null);
    if (cached && Date.now() - cached.t < maxAge) return cached.v;
    return null;
}

function cacheSet(key, value) {
    writeJSON(key, { t: Date.now(), v: value });
}

let toastTimer = null;

function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

function getAuthors(book) {
    if (Array.isArray(book.authors) && book.authors.length > 0) return book.authors;
    if (Array.isArray(book.author_name) && book.author_name.length > 0) return book.author_name;
    return [];
}

function getAuthor(book) {
    const authors = getAuthors(book);
    return authors.length > 0 ? authors.slice(0, 3).join(", ") : "Unknown Author";
}

function getYear(book) {
    return String(book.publishedDate || book.first_publish_year || "").slice(0, 4) || "Unknown";
}

function secureUrl(url) {
    return url ? String(url).replace(/^http:\/\//, "https://").replace(/&edge=curl/g, "") : "";
}

function htmlToText(html) {
    if (!html) return "";
    const withBreaks = String(html)
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n");
    const doc = new DOMParser().parseFromString(withBreaks, "text/html");
    return (doc.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

function toTitleCase(text) {
    return String(text)
        .toLowerCase()
        .replace(/(^|[\s(\-"])([a-z])/g, (match, before, letter) => before + letter.toUpperCase());
}

function formatDate(isoDate) {
    const [y, m, d] = String(isoDate).split("-").map(Number);
    if (!y || !m || !d) return isoDate;
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric"
    });
}

function escapeXml(text) {
    return String(text).replace(/[<>&'"]/g, c => ({
        "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;"
    }[c]));
}

/* A leather-bound placeholder cover for books without one */
function placeholderCover(title = "Untitled") {
    const words = String(title).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";

    words.forEach(word => {
        if ((line + " " + word).trim().length > 14) {
            if (line) lines.push(line);
            line = word;
        } else {
            line = (line + " " + word).trim();
        }
    });
    if (line) lines.push(line);

    const shown = lines.slice(0, 5);
    if (lines.length > 5) shown[4] = shown[4].slice(0, 12) + "…";

    const startY = 225 - (shown.length - 1) * 19;
    const tspans = shown
        .map((text, i) => `<tspan x='150' y='${startY + i * 38}'>${escapeXml(text)}</tspan>`)
        .join("");

    const svg =
        `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='450' viewBox='0 0 300 450'>` +
        `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
        `<stop offset='0' stop-color='#6e1c28'/><stop offset='1' stop-color='#3a0b13'/></linearGradient></defs>` +
        `<rect width='300' height='450' fill='url(#g)'/>` +
        `<rect x='0' y='0' width='22' height='450' fill='#000' opacity='.25'/>` +
        `<rect x='36' y='24' width='240' height='402' fill='none' stroke='#d4a95a' stroke-width='2' opacity='.75'/>` +
        `<rect x='44' y='32' width='224' height='386' fill='none' stroke='#d4a95a' stroke-width='1' opacity='.4'/>` +
        `<text x='150' y='92' text-anchor='middle' font-size='26' fill='#d4a95a'>✦</text>` +
        `<text text-anchor='middle' font-family='Georgia, serif' font-size='28' fill='#f1e4c8'>${tspans}</text>` +
        `<text x='150' y='380' text-anchor='middle' font-size='22' fill='#d4a95a'>❦</text>` +
        `</svg>`;

    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function setCover(img, book, large = false) {
    const url = (large && book.coverLarge) || book.cover || "";

    img.alt = `Cover of ${book.title || "this book"}`;
    img.onerror = null;

    if (url) {
        img.onerror = () => {
            img.onerror = null;
            img.src = placeholderCover(book.title);
        };
        img.src = url;
    } else {
        img.src = placeholderCover(book.title);
    }
}

/* Turn a Google Books "volume" into our simple book object */
function normalizeVolume(item) {
    const info = item.volumeInfo || {};
    const links = info.imageLinks || {};

    return {
        key: item.id,
        title: info.title || "Unknown Title",
        subtitle: info.subtitle || "",
        authors: Array.isArray(info.authors) ? info.authors : [],
        publisher: info.publisher || "",
        publishedDate: info.publishedDate || "",
        pageCount: info.pageCount || null,
        categories: Array.isArray(info.categories) ? info.categories : [],
        cover: secureUrl(links.thumbnail || links.smallThumbnail),
        coverLarge: secureUrl(links.large || links.medium || links.small || links.thumbnail),
        description: info.description || "",
        rating: info.averageRating || null,
        ratingsCount: info.ratingsCount || 0,
        infoLink: secureUrl(info.canonicalVolumeLink || info.infoLink)
    };
}

/* Older favorites (saved from Open Library) still display correctly */
function migrateFavorite(fav) {
    const book = { ...fav };

    if (!book.authors && Array.isArray(book.author_name)) book.authors = book.author_name;
    if (!book.cover && book.cover_i) book.cover = `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`;
    if (!book.publishedDate && book.first_publish_year) book.publishedDate = String(book.first_publish_year);
    if (!book.categories && Array.isArray(book.subject)) book.categories = book.subject.slice(0, 10);

    return book;
}

function isGoogleId(key) {
    return Boolean(key) && !key.startsWith("/") && !key.startsWith("nyt-");
}

/* "Fiction / Fantasy / Epic" → ["Fiction", "Fantasy", "Epic"] */
function bookGenres(book) {
    const parts = [];

    (book.categories || []).forEach(category => {
        String(category).split("/").forEach(part => parts.push(part.trim()));
    });

    return [
        ...new Set(
            parts.filter(part => part && part.toLowerCase() !== "general" && part.length <= 40)
        )
    ].slice(0, 12);
}

/* Only the fields we need to show a favorite later */
function pickBookData(book) {
    return {
        key: book.key,
        title: book.title || "Unknown Title",
        subtitle: book.subtitle || "",
        authors: getAuthors(book).slice(0, 5),
        publisher: book.publisher || "",
        publishedDate: book.publishedDate || "",
        pageCount: book.pageCount || null,
        categories: (book.categories || []).slice(0, 10),
        cover: book.cover || "",
        coverLarge: book.coverLarge || "",
        keepCover: Boolean(book.keepCover),
        rating: book.rating || null,
        ratingsCount: book.ratingsCount || 0,
        infoLink: book.infoLink || "",
        description: htmlToText(book.description).slice(0, 2000)
    };
}


/* =========================================================
   Storage (Supabase database or localStorage)
   ========================================================= */

function rowToFavorite(row) {
    return migrateFavorite({
        ...(row.data || {}),
        key: row.book_key,
        status: row.status || "Want to Read",
        category: row.category || "",
        savedAt: row.created_at
    });
}

const Store = {
    client: null,
    user: null,
    offline: false,
    favorites: [],
    categories: [],

    get cloudConfigured() {
        return Boolean(this.client);
    },

    get isCloud() {
        return Boolean(this.client && this.user && !this.offline);
    },

    favoriteToRow(fav) {
        const { status, category, savedAt, ...book } = fav;
        return {
            user_id: this.user.id,
            book_key: fav.key,
            status: status || "Want to Read",
            category: category || null,
            data: pickBookData(book)
        };
    },

    readLocalFavorites() {
        const list = readJSON(LS_FAVORITES, []);
        return Array.isArray(list)
            ? list.filter(item => item && item.key).map(migrateFavorite)
            : [];
    },

    readLocalCategories() {
        const list = readJSON(LS_CATEGORIES, null);
        return Array.isArray(list) ? list : [...DEFAULT_CATEGORIES];
    },

    async init() {
        if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY && window.supabase) {
            try {
                this.client = window.supabase.createClient(
                    CONFIG.SUPABASE_URL,
                    CONFIG.SUPABASE_ANON_KEY
                );

                const { data } = await this.client.auth.getSession();
                this.user = data.session ? data.session.user : null;

                this.client.auth.onAuthStateChange((_event, session) => {
                    const nextUser = session ? session.user : null;
                    const sameUser = (nextUser && nextUser.id) === (this.user && this.user.id);
                    if (sameUser) return;

                    this.user = nextUser;
                    this.offline = false;

                    // Supabase recommends not awaiting its calls inside this callback
                    setTimeout(() => {
                        this.load().then(onStoreChanged);
                    }, 0);
                });
            } catch (error) {
                console.error("Supabase setup failed", error);
                this.client = null;
            }
        }

        await this.load();
    },

    async load() {
        if (this.isCloud) {
            try {
                const [favResult, catResult] = await Promise.all([
                    this.client.from("favorites").select("*").order("created_at", { ascending: false }),
                    this.client.from("categories").select("name").order("created_at", { ascending: true })
                ]);

                if (favResult.error) throw favResult.error;
                if (catResult.error) throw catResult.error;

                this.favorites = favResult.data.map(rowToFavorite);
                this.categories = catResult.data.map(row => row.name);

                await this.importLocal();
                return;
            } catch (error) {
                console.error("Database load failed", error);
                this.offline = true;
                toast("Couldn't reach the online library — using this browser for now.");
            }
        }

        this.favorites = this.readLocalFavorites();
        this.categories = this.readLocalCategories();
    },

    /* First sign-in: copy favorites saved in this browser into the account */
    async importLocal() {
        const flag = `bookFinderImported:${this.user.id}`;
        if (readJSON(flag, false)) return;

        const localFavorites = this.readLocalFavorites();
        const localCategories = this.readLocalCategories();

        const newCategories = localCategories.filter(name => !this.categories.includes(name));
        const newFavorites = localFavorites.filter(
            fav => !this.favorites.some(existing => existing.key === fav.key)
        );

        if (newCategories.length > 0) {
            const { error } = await this.client
                .from("categories")
                .insert(newCategories.map(name => ({ user_id: this.user.id, name })));
            if (!error) this.categories.push(...newCategories);
        }

        if (newFavorites.length > 0) {
            const { error } = await this.client
                .from("favorites")
                .upsert(newFavorites.map(fav => this.favoriteToRow(fav)), { onConflict: "user_id,book_key" });
            if (!error) {
                this.favorites.push(...newFavorites);
                toast(`Moved ${newFavorites.length} favorite(s) into your account ✦`);
            }
        }

        writeJSON(flag, true);
    },

    persistLocal() {
        writeJSON(LS_FAVORITES, this.favorites);
        writeJSON(LS_CATEGORIES, this.categories);
    },

    get(key) {
        return this.favorites.find(fav => fav.key === key) || null;
    },

    async saveFavorite(fav) {
        const index = this.favorites.findIndex(item => item.key === fav.key);
        const previous = index >= 0 ? this.favorites[index] : null;

        const saved = {
            ...(previous || {}),
            ...fav,
            savedAt: (previous && previous.savedAt) || new Date().toISOString()
        };

        if (index >= 0) {
            this.favorites[index] = saved;
        } else {
            this.favorites.unshift(saved);
        }

        if (this.isCloud) {
            const { error } = await this.client
                .from("favorites")
                .upsert(this.favoriteToRow(saved), { onConflict: "user_id,book_key" });

            if (error) {
                if (previous) this.favorites[index] = previous;
                else this.favorites = this.favorites.filter(item => item.key !== fav.key);
                throw error;
            }
        } else {
            this.persistLocal();
        }

        return saved;
    },

    async removeFavorite(key) {
        const before = this.favorites;
        this.favorites = this.favorites.filter(fav => fav.key !== key);

        if (this.isCloud) {
            const { error } = await this.client.from("favorites").delete().eq("book_key", key);
            if (error) {
                this.favorites = before;
                throw error;
            }
        } else {
            this.persistLocal();
        }
    },

    async addCategory(rawName) {
        const name = String(rawName || "").trim().slice(0, 40);

        if (!name) throw new Error("Category name is empty.");
        if (name === UNCATEGORIZED || name === NEW_CATEGORY || name.toLowerCase() === "all") {
            throw new Error("Please choose another name.");
        }
        if (this.categories.some(existing => existing.toLowerCase() === name.toLowerCase())) {
            throw new Error("That category already exists.");
        }

        if (this.isCloud) {
            const { error } = await this.client
                .from("categories")
                .insert({ user_id: this.user.id, name });
            if (error) throw error;
        }

        this.categories.push(name);
        if (!this.isCloud) this.persistLocal();

        return name;
    },

    async removeCategory(name) {
        if (this.isCloud) {
            const { error } = await this.client.from("categories").delete().eq("name", name);
            if (error) throw error;

            const { error: updateError } = await this.client
                .from("favorites")
                .update({ category: null })
                .eq("category", name);
            if (updateError) throw updateError;
        }

        this.categories = this.categories.filter(item => item !== name);
        this.favorites = this.favorites.map(fav =>
            fav.category === name ? { ...fav, category: "" } : fav
        );

        if (!this.isCloud) this.persistLocal();
    },

    async signIn(email, password) {
        const { error } = await this.client.auth.signInWithPassword({ email, password });
        if (error) throw error;
    },

    async signUp(email, password) {
        const { data, error } = await this.client.auth.signUp({ email, password });
        if (error) throw error;
        return data;
    },

    async signOut() {
        const { error } = await this.client.auth.signOut();
        if (error) throw error;
    }
};


/* =========================================================
   Pages & navigation
   ========================================================= */

const homePage = $("home-page");
const loadingPage = $("loading-page");
const resultsPage = $("results-page");
const favoritesPage = $("favorites-page");
const detailsPage = $("details-page");
const helpPage = $("help-page");
const messagePage = $("message-page");

const pages = [homePage, loadingPage, resultsPage, favoritesPage, detailsPage, helpPage, messagePage];

let pageHistory = [];

function showPage(page, addToHistory = true) {
    const currentPage = pages.find(el => !el.classList.contains("hidden"));

    if (
        addToHistory &&
        currentPage &&
        currentPage !== page &&
        currentPage !== loadingPage &&
        currentPage !== messagePage
    ) {
        pageHistory.push(currentPage);
    }

    pages.forEach(el => el.classList.add("hidden"));
    page.classList.remove("hidden");

    if (page === resultsPage) refreshResultHearts();
    if (page === favoritesPage) renderFavorites();
    if (page === detailsPage) updateFavoriteUI();

    window.scrollTo(0, 0);
}

function goBack() {
    const previousPage = pageHistory.pop();
    showPage(previousPage || homePage, false);
}

function showLoading() {
    showPage(loadingPage);
}

function showMessage(title, text) {
    $("message-title").textContent = title;
    $("message-text").textContent = text;
    showPage(messagePage);
}

function goHome() {
    pageHistory = [];
    showPage(homePage, false);
}

$("logo-btn").addEventListener("click", goHome);
$("home-nav").addEventListener("click", goHome);
$("favorites-nav").addEventListener("click", () => showPage(favoritesPage));
$("help-nav").addEventListener("click", () => showPage(helpPage));

["results-back-btn", "favorites-back-btn", "details-back-btn", "help-back-btn", "message-back-btn"]
    .forEach(id => $(id).addEventListener("click", goBack));


/* =========================================================
   Google Books API
   ========================================================= */

function googleUrl(path, params = {}) {
    const search = new URLSearchParams(params);
    if (GOOGLE_KEY) search.set("key", GOOGLE_KEY);
    return `${GOOGLE_BOOKS_URL}${path}?${search}`;
}

async function googleFetch(path, params) {
    const response = await fetch(googleUrl(path, params));

    if (response.status === 429 || response.status === 403) {
        const error = new Error(
            "Google Books said no — the daily limit was reached, or the API key isn't allowed on this website. Check your key in config.js."
        );
        error.friendly = true;
        throw error;
    }

    if (!response.ok) {
        throw new Error(`Google Books request failed (${response.status})`);
    }

    return response.json();
}

function buildQuery(query, type) {
    const q = query.trim().replace(/"/g, "");
    const quoted = q.includes(" ") ? `"${q}"` : q;

    if (type === "title") return `intitle:${quoted}`;
    if (type === "author") return `inauthor:${quoted}`;
    if (type === "genre") return `subject:${quoted}`;
    return q;
}

async function fetchBooks(query, type = "all", page = 1) {
    const data = await googleFetch("", {
        q: buildQuery(query, type),
        startIndex: String((page - 1) * PAGE_SIZE),
        maxResults: String(PAGE_SIZE),
        printType: "books"
    });

    return {
        books: (data.items || []).map(normalizeVolume),
        total: data.totalItems || 0
    };
}


/* =========================================================
   Search (one search bar)
   ========================================================= */

let lastSearch = null; // { query, type, page, total, seen, shown, done }

const PLACEHOLDERS = {
    all: "Search for a book...",
    title: "Type a book title...",
    author: "Type an author's name...",
    genre: "Type a genre — fantasy, poetry, dragons..."
};

function searchTitle(query, type) {
    if (type === "genre") return `Books in “${query}”`;
    if (type === "author") return `Books by “${query}”`;
    if (type === "title") return `Titles matching “${query}”`;
    return `Results for “${query}”`;
}

function takeNew(books, seen) {
    return books.filter(book => {
        if (seen.has(book.key)) return false;
        seen.add(book.key);
        return true;
    });
}

async function runSearch(query, type = "all") {
    showLoading();

    try {
        const { books, total } = await fetchBooks(query, type, 1);
        const seen = new Set();
        const fresh = takeNew(books, seen);

        lastSearch = {
            query,
            type,
            page: 1,
            total,
            seen,
            shown: fresh.length,
            done: books.length < PAGE_SIZE
        };

        $("results-title").textContent = searchTitle(query, type);
        updateResultsCount();

        $("results-list").innerHTML = "";
        renderResults(fresh, false);

        showPage(resultsPage);
    } catch (error) {
        console.error(error);
        showMessage(
            "Something went wrong",
            error.friendly
                ? error.message
                : "Unable to find books right now. Please check your connection and try again."
        );
    }
}

function updateResultsCount() {
    if (!lastSearch) return;

    const { total, shown, done } = lastSearch;

    $("results-count").textContent = shown
        ? `Showing ${shown.toLocaleString()} of about ${Math.max(total, shown).toLocaleString()} books`
        : "";

    $("load-more-btn").classList.toggle("hidden", done || shown === 0);
}

$("load-more-btn").addEventListener("click", async () => {
    if (!lastSearch) return;

    const button = $("load-more-btn");
    button.disabled = true;
    button.textContent = "Loading…";

    try {
        const nextPage = lastSearch.page + 1;
        const { books } = await fetchBooks(lastSearch.query, lastSearch.type, nextPage);
        const fresh = takeNew(books, lastSearch.seen);

        lastSearch.page = nextPage;
        lastSearch.shown += fresh.length;
        if (books.length < PAGE_SIZE || fresh.length === 0) lastSearch.done = true;

        renderResults(fresh, true);
        updateResultsCount();
    } catch (error) {
        toast(error.friendly ? error.message : "Couldn't load more books. Try again.");
    } finally {
        button.disabled = false;
        button.textContent = "Load more books";
    }
});

$("search-type").addEventListener("change", () => {
    $("search-input").placeholder = PLACEHOLDERS[$("search-type").value] || PLACEHOLDERS.all;
    $("search-input").focus();
});

$("search-form").addEventListener("submit", event => {
    event.preventDefault();

    const query = $("search-input").value.trim();

    if (!query) {
        toast("Type a title, author, or genre first ✦");
        $("search-input").focus();
        return;
    }

    runSearch(query, $("search-type").value);
});

/* Genre chips just fill the one search bar in "Genre" mode */
document.querySelectorAll("[data-genre]").forEach(button => {
    button.addEventListener("click", () => {
        const genre = button.dataset.genre;

        $("search-type").value = "genre";
        $("search-input").value = genre;
        $("search-input").placeholder = PLACEHOLDERS.genre;

        runSearch(genre, "genre");
    });
});


/* =========================================================
   Popular shelf (changes over time)
   ========================================================= */

let activePopular = 0;

function weekNumber() {
    return Math.floor(Date.now() / (7 * 24 * HOUR));
}

function popularSources() {
    if (NYT_KEY) {
        return POPULAR_LISTS.map(list => ({ kind: "nyt", ...list }));
    }

    // No NYT key: 3 genres that rotate every week
    const week = weekNumber();

    return [0, 1, 2].map(i => {
        const genre = SPOTLIGHT_GENRES[(week * 3 + i) % SPOTLIGHT_GENRES.length];
        return { kind: "spotlight", id: genre, label: genre.replace(" Fiction", "") };
    });
}

async function fetchPopular(source) {
    if (source.kind === "nyt") {
        const cacheKey = `bf-popular-nyt-${source.id}`;
        const cached = cacheGet(cacheKey, 6 * HOUR);
        if (cached) return cached;

        const response = await fetch(
            `https://api.nytimes.com/svc/books/v3/lists/current/${source.id}.json?api-key=${encodeURIComponent(NYT_KEY)}`
        );

        if (!response.ok) throw new Error(`NYT request failed (${response.status})`);

        const data = await response.json();
        const results = data.results || {};

        const books = (results.books || []).map(b => ({
            key: "",
            isbn: b.primary_isbn13 || b.primary_isbn10 || "",
            title: toTitleCase(b.title || "Unknown Title"),
            subtitle: "",
            authors: b.author ? [b.author] : [],
            publisher: b.publisher || "",
            publishedDate: "",
            pageCount: null,
            categories: [source.label],
            cover: secureUrl(b.book_image),
            coverLarge: secureUrl(b.book_image),
            keepCover: true,
            description: b.description || "",
            rating: null,
            ratingsCount: 0,
            infoLink: "",
            rank: b.rank,
            weeksOnList: b.weeks_on_list || 0
        }));

        const value = { books, updated: results.published_date || "" };
        cacheSet(cacheKey, value);
        return value;
    }

    const cacheKey = `bf-popular-${source.id}-${weekNumber()}`;
    const cached = cacheGet(cacheKey, 24 * HOUR);
    if (cached) return cached;

    const { books } = await fetchBooks(source.id, "genre", 1);
    const withCovers = books.filter(book => book.cover);
    const picked = (withCovers.length >= 6 ? withCovers : books)
        .slice(0, 12)
        .map((book, i) => ({ ...book, rank: i + 1 }));

    const value = { books: picked, updated: "" };
    cacheSet(cacheKey, value);
    return value;
}

function renderPopularTabs(sources) {
    const tabs = $("popular-tabs");
    tabs.innerHTML = "";

    sources.forEach((source, index) => {
        const tab = document.createElement("button");
        tab.type = "button";
        tab.className = "popular-tab" + (index === activePopular ? " active" : "");
        tab.textContent = source.label;
        tab.addEventListener("click", () => loadPopular(index));
        tabs.appendChild(tab);
    });
}

function createPopularCard(book) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "popular-card";
    card.setAttribute("aria-label", `${book.title} by ${getAuthor(book)}`);

    const rank = document.createElement("span");
    rank.className = "popular-rank";
    rank.textContent = book.rank || "";

    const img = document.createElement("img");
    img.loading = "lazy";
    setCover(img, book);

    const title = document.createElement("span");
    title.className = "popular-title";
    title.textContent = book.title;

    const author = document.createElement("span");
    author.className = "popular-author";
    author.textContent = getAuthor(book);

    card.append(rank, img, title, author);

    if (book.weeksOnList > 1) {
        const weeks = document.createElement("span");
        weeks.className = "popular-weeks";
        weeks.textContent = `${book.weeksOnList} weeks on the list`;
        card.appendChild(weeks);
    }

    card.addEventListener("click", () => openPopular(book));

    return card;
}

async function loadPopular(index = 0) {
    const sources = popularSources();
    activePopular = index;
    renderPopularTabs(sources);

    $("popular-sub").textContent = NYT_KEY
        ? "New York Times Best Sellers"
        : "This week's spotlight genres — a new set every week";

    const list = $("popular-list");
    list.classList.add("is-message");
    list.innerHTML = `<p class="muted">Dusting off the shelves…</p>`;

    try {
        const { books, updated } = await fetchPopular(sources[index]);
        if (activePopular !== index) return;

        if (NYT_KEY && updated) {
            $("popular-sub").textContent = `New York Times Best Sellers · updated ${formatDate(updated)}`;
        }

        if (!books.length) {
            list.innerHTML = `<p class="muted">No popular books right now.</p>`;
            return;
        }

        list.classList.remove("is-message");
        list.innerHTML = "";

        const fragment = document.createDocumentFragment();
        books.forEach(book => fragment.appendChild(createPopularCard(book)));
        list.appendChild(fragment);
    } catch (error) {
        console.error(error);
        if (activePopular !== index) return;
        list.innerHTML = `<p class="muted">Popular books are taking a nap. Please try again later.</p>`;
    }
}

/* NYT books are looked up on Google Books by ISBN for full details */
async function openPopular(book) {
    if (book.key) {
        showDetails(book);
        return;
    }

    showLoading();

    let match = null;

    if (book.isbn) {
        try {
            const data = await googleFetch("", { q: `isbn:${book.isbn}`, maxResults: "1" });
            if (data.items && data.items.length > 0) match = normalizeVolume(data.items[0]);
        } catch (error) {
            console.warn("ISBN lookup failed", error);
        }
    }

    if (match) {
        showDetails({
            ...match,
            cover: book.cover || match.cover,
            coverLarge: book.cover || match.coverLarge,
            keepCover: Boolean(book.cover),
            description: match.description || book.description
        });
    } else {
        showDetails({ ...book, key: `nyt-${book.isbn || book.title}` });
    }
}


/* =========================================================
   Result cards
   ========================================================= */

function createBookCard(book) {
    const card = document.createElement("article");
    card.className = "book-card";
    card.dataset.key = book.key;

    const coverButton = document.createElement("button");
    coverButton.type = "button";
    coverButton.className = "book-card-cover";
    coverButton.setAttribute("aria-label", `View details for ${book.title || "this book"}`);

    const cover = document.createElement("img");
    cover.loading = "lazy";
    setCover(cover, book);
    coverButton.appendChild(cover);
    coverButton.addEventListener("click", () => showDetails(book));

    const heart = document.createElement("button");
    heart.type = "button";
    heart.className = "heart-btn";
    heart.addEventListener("click", () => quickFavorite(book));

    const info = document.createElement("div");
    info.className = "book-card-info";

    const title = document.createElement("h2");
    title.textContent = book.title || "Unknown Title";

    const author = document.createElement("p");
    author.className = "book-card-author";
    author.textContent = getAuthor(book);

    const year = document.createElement("p");
    year.className = "book-card-year";
    const y = getYear(book);
    year.textContent = y === "Unknown" ? "Year unknown" : `Published ${y}`;

    const detailsButton = document.createElement("button");
    detailsButton.type = "button";
    detailsButton.className = "btn btn-ghost btn-small";
    detailsButton.textContent = "View Details";
    detailsButton.addEventListener("click", () => showDetails(book));

    info.append(title, author, year, detailsButton);
    card.append(coverButton, heart, info);

    updateHeart(card);

    return card;
}

function updateHeart(card) {
    const heart = card.querySelector(".heart-btn");
    const isFavorite = Boolean(Store.get(card.dataset.key));

    heart.textContent = isFavorite ? "♥" : "♡";
    heart.classList.toggle("is-favorite", isFavorite);
    heart.setAttribute("aria-label", isFavorite ? "In favorites — edit" : "Add to favorites");
    heart.title = isFavorite ? "In your favorites" : "Add to favorites";
}

function refreshResultHearts() {
    document.querySelectorAll("#results-list .book-card").forEach(updateHeart);
}

async function quickFavorite(book) {
    if (Store.get(book.key)) {
        showDetails(book, { openFavorite: true });
        return;
    }

    try {
        await Store.saveFavorite({ ...pickBookData(book), status: "Want to Read", category: "" });
        toast(`“${book.title}” added to favorites ♥`);
        onStoreChanged();
    } catch (error) {
        console.error(error);
        toast("Couldn't save that favorite. Please try again.");
    }
}

function renderResults(books, append) {
    const list = $("results-list");

    if (!append && (!books || books.length === 0)) {
        list.innerHTML = `
            <div class="no-results">
                <h2>No books found</h2>
                <p>Try another title, author, or genre.</p>
            </div>
        `;
        return;
    }

    const fragment = document.createDocumentFragment();
    books.forEach(book => fragment.appendChild(createBookCard(book)));
    list.appendChild(fragment);
}


/* =========================================================
   Book details
   ========================================================= */

let currentBook = null;

function fillFacts(book) {
    $("book-publisher").textContent = book.publisher || "Unknown";
    $("book-date").textContent = book.publishedDate || "Unknown";
    $("book-pages").textContent = book.pageCount || "Unknown";
    $("book-rating").textContent = book.rating
        ? `★ ${Number(book.rating).toFixed(1)} (${Number(book.ratingsCount || 0).toLocaleString()} ratings)`
        : "No ratings yet";

    const subtitle = $("book-subtitle");
    subtitle.textContent = book.subtitle || "";
    subtitle.classList.toggle("hidden", !book.subtitle);
}

function setInfoLink(book) {
    $("open-book-btn").href =
        book.infoLink ||
        (isGoogleId(book.key)
            ? `https://books.google.com/books?id=${encodeURIComponent(book.key)}`
            : `https://www.google.com/search?tbm=bks&q=${encodeURIComponent(`${book.title} ${getAuthor(book)}`)}`);
}

async function showDetails(book, { openFavorite = false } = {}) {
    currentBook = book;

    $("book-title").textContent = book.title || "Unknown Title";
    $("book-author").textContent = getAuthor(book);
    fillFacts(book);
    setCover($("book-cover"), book, true);
    setInfoLink(book);

    const willFetch = isGoogleId(book.key);
    const text = htmlToText(book.description);

    $("book-description").textContent =
        text || (willFetch ? "Unrolling the scroll…" : "No description available.");

    renderGenres(bookGenres(book), willFetch);

    $("favorite-panel").classList.toggle("hidden", !(openFavorite || Store.get(book.key)));

    showPage(detailsPage);

    if (!willFetch) return;

    try {
        const data = await googleFetch(`/${encodeURIComponent(book.key)}`, {});
        if (currentBook !== book) return; // user already opened another book

        const full = normalizeVolume(data);

        ["subtitle", "publisher", "publishedDate", "pageCount", "rating", "ratingsCount", "infoLink"]
            .forEach(field => {
                if (full[field]) book[field] = full[field];
            });

        if (full.description) book.description = full.description;
        if (full.categories.length > 0) book.categories = full.categories;
        if (!book.keepCover && full.coverLarge) {
            book.coverLarge = full.coverLarge;
            setCover($("book-cover"), book, true);
        }

        fillFacts(book);
        setInfoLink(book);
        $("book-description").textContent = htmlToText(book.description) || "No description available.";
        renderGenres(bookGenres(book), false);
    } catch (error) {
        console.warn("Details request failed", error);
        if (currentBook !== book) return;
        if (!text) $("book-description").textContent = "No description available.";
        renderGenres(bookGenres(book), false);
    }
}

function renderGenres(genres, loading = false) {
    const container = $("book-genres");
    container.innerHTML = "";

    if (!genres || genres.length === 0) {
        container.innerHTML = `<span class="muted">${loading ? "Loading genres..." : "No genres available"}</span>`;
        return;
    }

    genres.forEach(genre => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chip chip-small";
        button.textContent = genre;
        button.addEventListener("click", () => {
            $("search-type").value = "genre";
            $("search-input").value = genre;
            runSearch(genre, "genre");
        });
        container.appendChild(button);
    });
}


/* =========================================================
   Favorite controls on the details page
   ========================================================= */

function fillCategorySelect(select, selected = "") {
    select.innerHTML = "";

    select.appendChild(new Option("No category", ""));
    Store.categories.forEach(name => select.appendChild(new Option(name, name)));
    select.appendChild(new Option("＋ New category…", NEW_CATEGORY));

    select.value = Store.categories.includes(selected) ? selected : "";
    select.dataset.previous = select.value;
}

/* Handles the "＋ New category…" option on any category dropdown */
async function handleCategoryChange(select) {
    if (select.value !== NEW_CATEGORY) {
        select.dataset.previous = select.value;
        return true;
    }

    const name = window.prompt("Name your new category (e.g. Summer Reads):");

    if (!name || !name.trim()) {
        select.value = select.dataset.previous || "";
        return false;
    }

    try {
        const created = await Store.addCategory(name);
        fillCategorySelect(select, created);
        toast(`Category “${created}” created ✦`);
        return true;
    } catch (error) {
        toast(error.message || "Couldn't create that category.");
        select.value = select.dataset.previous || "";
        return false;
    }
}

function updateFavoriteUI() {
    if (!currentBook) return;

    const favorite = Store.get(currentBook.key);

    $("favorite-btn").textContent = favorite ? "♥ In Your Favorites" : "♡ Add to Favorites";
    $("favorite-btn").classList.toggle("is-favorite", Boolean(favorite));
    $("favorite-status").value = favorite ? favorite.status || "Want to Read" : "Want to Read";
    fillCategorySelect($("favorite-category"), favorite ? favorite.category : "");
    $("save-favorite-btn").textContent = favorite ? "Update Favorite" : "Save to Favorites";
    $("remove-favorite-btn").classList.toggle("hidden", !favorite);
}

$("favorite-btn").addEventListener("click", () => {
    $("favorite-panel").classList.toggle("hidden");
});

$("favorite-category").addEventListener("change", event => {
    handleCategoryChange(event.target);
});

$("save-favorite-btn").addEventListener("click", async () => {
    if (!currentBook || !currentBook.key) return;

    const button = $("save-favorite-btn");
    button.disabled = true;

    try {
        const category = $("favorite-category").value;

        await Store.saveFavorite({
            ...pickBookData(currentBook),
            status: $("favorite-status").value,
            category: category === NEW_CATEGORY ? "" : category
        });

        toast("Saved to your favorites ♥");
        onStoreChanged();
    } catch (error) {
        console.error(error);
        toast("Couldn't save. Please check your connection.");
    } finally {
        button.disabled = false;
    }
});

$("remove-favorite-btn").addEventListener("click", async () => {
    if (!currentBook) return;

    try {
        await Store.removeFavorite(currentBook.key);
        $("favorite-panel").classList.add("hidden");
        toast("Removed from favorites");
        onStoreChanged();
    } catch (error) {
        console.error(error);
        toast("Couldn't remove it. Please try again.");
    }
});


/* =========================================================
   Favorites page (categories + status + search)
   ========================================================= */

let activeCategory = "All";

$("favorite-status-filter").addEventListener("change", renderFavorites);
$("favorite-search").addEventListener("input", renderFavorites);

$("add-category-btn").addEventListener("click", async () => {
    const name = window.prompt("Name your new category (e.g. Summer Reads):");
    if (!name || !name.trim()) return;

    try {
        const created = await Store.addCategory(name);
        activeCategory = created;
        toast(`Category “${created}” created ✦`);
        renderFavorites();
    } catch (error) {
        toast(error.message || "Couldn't create that category.");
    }
});

function renderCategoryTabs() {
    const tabs = $("category-tabs");
    tabs.innerHTML = "";

    if (
        activeCategory !== "All" &&
        activeCategory !== UNCATEGORIZED &&
        !Store.categories.includes(activeCategory)
    ) {
        activeCategory = "All";
    }

    const count = filterFn => Store.favorites.filter(filterFn).length;

    const entries = [
        { id: "All", label: "All", n: Store.favorites.length, removable: false },
        ...Store.categories.map(name => ({
            id: name,
            label: name,
            n: count(fav => fav.category === name),
            removable: true
        })),
        { id: UNCATEGORIZED, label: "Uncategorized", n: count(fav => !fav.category), removable: false }
    ];

    entries.forEach(entry => {
        const wrap = document.createElement("span");
        wrap.className = "category-tab" + (entry.id === activeCategory ? " active" : "");

        const tab = document.createElement("button");
        tab.type = "button";
        tab.className = "category-tab-btn";

        const label = document.createElement("span");
        label.textContent = entry.label;

        const countBadge = document.createElement("span");
        countBadge.className = "tab-count";
        countBadge.textContent = entry.n;

        tab.append(label, countBadge);
        tab.addEventListener("click", () => {
            activeCategory = entry.id;
            renderFavorites();
        });

        wrap.appendChild(tab);

        if (entry.removable) {
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "category-remove";
            remove.textContent = "×";
            remove.setAttribute("aria-label", `Delete category ${entry.label}`);
            remove.title = "Delete category";
            remove.addEventListener("click", async () => {
                const ok = window.confirm(
                    `Delete the category “${entry.label}”? Books in it stay in your favorites as Uncategorized.`
                );
                if (!ok) return;

                try {
                    await Store.removeCategory(entry.label);
                    toast(`Category “${entry.label}” deleted`);
                    onStoreChanged();
                } catch (error) {
                    console.error(error);
                    toast("Couldn't delete that category.");
                }
            });
            wrap.appendChild(remove);
        }

        tabs.appendChild(wrap);
    });
}

function renderFavoritesStats() {
    const all = Store.favorites;
    const byStatus = status => all.filter(fav => (fav.status || "Want to Read") === status).length;

    $("favorites-stats").textContent = all.length
        ? `${all.length} book${all.length === 1 ? "" : "s"} · ${byStatus("Reading")} reading · ${byStatus("Completed")} completed · ${byStatus("Want to Read")} to read`
        : "Your shelves are waiting for their first book.";
}

function renderFavorites() {
    renderCategoryTabs();
    renderFavoritesStats();
    renderSyncNote();

    const list = $("favorites-list");
    list.innerHTML = "";

    const status = $("favorite-status-filter").value;
    const text = $("favorite-search").value.trim().toLowerCase();

    const filtered = Store.favorites.filter(fav => {
        const category = fav.category || "";

        if (activeCategory === UNCATEGORIZED && category) return false;
        if (activeCategory !== "All" && activeCategory !== UNCATEGORIZED && category !== activeCategory) return false;
        if (status !== "All" && (fav.status || "Want to Read") !== status) return false;
        if (text && !`${fav.title} ${getAuthor(fav)}`.toLowerCase().includes(text)) return false;

        return true;
    });

    if (filtered.length === 0) {
        list.innerHTML = `
            <div class="no-results">
                <h2>${Store.favorites.length ? "Nothing on this shelf yet" : "No favorite books yet"}</h2>
                <p>${Store.favorites.length
                    ? "Try another category or status, or give a book this category from its details page."
                    : "Tap ♡ on any book to add it to your library."}</p>
            </div>
        `;
        return;
    }

    const fragment = document.createDocumentFragment();
    filtered.forEach(fav => fragment.appendChild(createFavoriteCard(fav)));
    list.appendChild(fragment);
}

function createFavoriteCard(fav) {
    const card = document.createElement("article");
    card.className = "fav-card panel";

    const cover = document.createElement("img");
    cover.loading = "lazy";
    setCover(cover, fav);
    cover.addEventListener("click", () => showDetails(fav));

    const info = document.createElement("div");
    info.className = "fav-card-info";

    const title = document.createElement("h2");
    title.textContent = fav.title || "Unknown Title";

    const author = document.createElement("p");
    author.className = "book-card-author";
    author.textContent = getAuthor(fav);

    const tags = document.createElement("div");
    tags.className = "fav-tags";

    const currentStatus = fav.status || "Want to Read";

    const statusPill = document.createElement("span");
    statusPill.className = "status-pill status-" + currentStatus.toLowerCase().replace(/\s+/g, "-");
    statusPill.textContent = currentStatus;
    tags.appendChild(statusPill);

    if (fav.category) {
        const categoryPill = document.createElement("span");
        categoryPill.className = "category-pill";
        categoryPill.textContent = "❦ " + fav.category;
        tags.appendChild(categoryPill);
    }

    const controls = document.createElement("div");
    controls.className = "fav-controls";

    // Status dropdown — saves immediately
    const statusLabel = document.createElement("label");
    statusLabel.innerHTML = "<span>Status</span>";
    const statusSelect = document.createElement("select");
    STATUSES.forEach(s => statusSelect.appendChild(new Option(s, s)));
    statusSelect.value = currentStatus;
    statusSelect.addEventListener("change", async () => {
        try {
            await Store.saveFavorite({ ...fav, status: statusSelect.value });
            toast(`Marked as ${statusSelect.value}`);
            onStoreChanged();
        } catch (error) {
            toast("Couldn't update status.");
            statusSelect.value = currentStatus;
        }
    });
    statusLabel.appendChild(statusSelect);

    // Category dropdown — saves immediately
    const categoryLabel = document.createElement("label");
    categoryLabel.innerHTML = "<span>Category</span>";
    const categorySelect = document.createElement("select");
    fillCategorySelect(categorySelect, fav.category);
    categorySelect.addEventListener("change", async () => {
        const ok = await handleCategoryChange(categorySelect);
        if (!ok) return;

        try {
            await Store.saveFavorite({ ...fav, category: categorySelect.value });
            toast(categorySelect.value ? `Moved to “${categorySelect.value}”` : "Removed from category");
            onStoreChanged();
        } catch (error) {
            toast("Couldn't update category.");
        }
    });
    categoryLabel.appendChild(categorySelect);

    controls.append(statusLabel, categoryLabel);

    const buttons = document.createElement("div");
    buttons.className = "row";

    const detailsButton = document.createElement("button");
    detailsButton.type = "button";
    detailsButton.className = "btn btn-ghost btn-small";
    detailsButton.textContent = "View Details";
    detailsButton.addEventListener("click", () => showDetails(fav));

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "btn btn-danger btn-small";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", async () => {
        try {
            await Store.removeFavorite(fav.key);
            toast(`Removed “${fav.title}”`);
            onStoreChanged();
        } catch (error) {
            toast("Couldn't remove it. Please try again.");
        }
    });

    buttons.append(detailsButton, removeButton);

    info.append(title, author, tags, controls, buttons);
    card.append(cover, info);

    return card;
}


/* =========================================================
   Account (Supabase auth)
   ========================================================= */

const accountDialog = $("account-dialog");

function renderSyncNote() {
    const note = $("sync-note");

    if (Store.isCloud) {
        note.textContent = `☁ Synced to your account (${Store.user.email})`;
    } else if (Store.cloudConfigured && Store.user && Store.offline) {
        note.textContent = "⚠ Offline — changes are saved in this browser for now.";
    } else if (Store.cloudConfigured) {
        note.innerHTML = `Saved in this browser · <button type="button" class="link-btn" id="sync-sign-in">Sign in</button> to keep your library on every device.`;
        $("sync-sign-in").addEventListener("click", openAccount);
    } else {
        note.textContent = "Saved in this browser.";
    }
}

function updateAccountUI() {
    const nav = $("account-nav");

    if (!Store.cloudConfigured) {
        nav.classList.add("hidden");
        return;
    }

    nav.classList.remove("hidden");
    nav.textContent = Store.user ? "☁ Account" : "☁ Sign In";

    $("account-signed-out").classList.toggle("hidden", Boolean(Store.user));
    $("account-signed-in").classList.toggle("hidden", !Store.user);
    $("account-user").textContent = Store.user ? Store.user.email : "";
    $("account-intro").textContent = Store.user
        ? "Your favorites and categories are saved in the online library."
        : "Sign in to save your favorites online and see them on any device.";
}

function openAccount() {
    $("account-message").textContent = "";
    updateAccountUI();
    accountDialog.showModal();
}

function accountMessage(text, isError = false) {
    const el = $("account-message");
    el.textContent = text;
    el.classList.toggle("error", isError);
}

function readCredentials() {
    const email = $("account-email").value.trim();
    const password = $("account-password").value;

    if (!email || !email.includes("@")) {
        accountMessage("Please enter a valid email.", true);
        return null;
    }
    if (password.length < 6) {
        accountMessage("Password needs at least 6 characters.", true);
        return null;
    }
    return { email, password };
}

$("account-nav").addEventListener("click", openAccount);

$("sign-in-btn").addEventListener("click", async () => {
    const creds = readCredentials();
    if (!creds) return;

    accountMessage("Opening the library doors…");

    try {
        await Store.signIn(creds.email, creds.password);
        $("account-password").value = "";
        accountDialog.close();
        toast("Welcome back ✦");
    } catch (error) {
        accountMessage(error.message || "Sign in failed.", true);
    }
});

$("sign-up-btn").addEventListener("click", async () => {
    const creds = readCredentials();
    if (!creds) return;

    accountMessage("Creating your library card…");

    try {
        const data = await Store.signUp(creds.email, creds.password);
        $("account-password").value = "";

        if (data && data.session) {
            accountDialog.close();
            toast("Account created — welcome ✦");
        } else {
            accountMessage("Check your email to confirm your account, then sign in.");
        }
    } catch (error) {
        accountMessage(error.message || "Sign up failed.", true);
    }
});

$("sign-out-btn").addEventListener("click", async () => {
    try {
        await Store.signOut();
        accountDialog.close();
        toast("Signed out");
    } catch (error) {
        accountMessage(error.message || "Sign out failed.", true);
    }
});


/* =========================================================
   Keep every view in sync after data changes
   ========================================================= */

function onStoreChanged() {
    $("favorites-count").textContent = Store.favorites.length;

    updateAccountUI();
    refreshResultHearts();

    if (!detailsPage.classList.contains("hidden")) updateFavoriteUI();
    if (!favoritesPage.classList.contains("hidden")) renderFavorites();
}


/* =========================================================
   Start
   ========================================================= */

(async function start() {
    if (!GOOGLE_KEY) {
        console.warn("No Google Books API key in config.js — searches may hit the free limit quickly.");
    }

    $("footer-nyt").classList.toggle("hidden", !NYT_KEY);

    loadPopular(0);

    await Store.init();
    onStoreChanged();
})();
