const homePage = document.getElementById("home-page");
const loadingPage = document.getElementById("loading-page");
const resultsPage = document.getElementById("results-page");
const favoritesPage = document.getElementById("favorites-page");
const detailsPage = document.getElementById("details-page");
const helpPage = document.getElementById("help-page");
const messagePage = document.getElementById("message-page");

const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");

const resultsList = document.getElementById("results-list");
const resultsTitle = document.getElementById("results-title");

const favoritesList = document.getElementById("favorites-list");
const favoriteStatusFilter = document.getElementById("favorite-status-filter");

const bookCover = document.getElementById("book-cover");
const bookTitle = document.getElementById("book-title");
const bookAuthor = document.getElementById("book-author");
const bookPublisher = document.getElementById("book-publisher");
const bookDate = document.getElementById("book-date");
const bookPages = document.getElementById("book-pages");
const bookGenres = document.getElementById("book-genres");
const bookDescription = document.getElementById("book-description");
const openBookBtn = document.getElementById("open-book-btn");

const favoriteBtn = document.getElementById("favorite-btn");
const favoriteStatusContainer = document.getElementById("favorite-status-container");
const favoriteStatus = document.getElementById("favorite-status");
const saveFavoriteBtn = document.getElementById("save-favorite-btn");
const removeFavoriteBtn = document.getElementById("remove-favorite-btn");

let currentBook = null;
let pageHistory = [];

function showPage(page, addToHistory = true) {
    const pages = [
        homePage,
        loadingPage,
        resultsPage,
        favoritesPage,
        detailsPage,
        helpPage,
        messagePage
    ];

    const currentPage = pages.find(
        pageElement => !pageElement.classList.contains("hidden")
    );

    if (
        addToHistory &&
        currentPage &&
        currentPage !== page &&
        currentPage !== loadingPage &&
        currentPage !== messagePage
    ) {
        pageHistory.push(currentPage);
    }

    pages.forEach(pageElement => {
        pageElement.classList.add("hidden");
    });

    page.classList.remove("hidden");
}

function goBack() {
    if (pageHistory.length === 0) {
        showPage(homePage, false);
        return;
    }

    const previousPage = pageHistory.pop();

    showPage(previousPage, false);
}

function showLoading() {
    showPage(loadingPage);
}

function showMessage(title, text) {
    document.getElementById("message-title").textContent = title;
    document.getElementById("message-text").textContent = text;

    showPage(messagePage);
}

document.getElementById("home-nav").addEventListener("click", () => {
    pageHistory = [];
    showPage(homePage, false);
});

document.getElementById("favorites-nav").addEventListener("click", () => {
    renderFavorites();
    showPage(favoritesPage);
});

document.getElementById("help-nav").addEventListener("click", () => {
    showPage(helpPage);
});

document.getElementById("results-back-btn").addEventListener("click", () => {
    goBack();
});

document.getElementById("favorites-back-btn").addEventListener("click", () => {
    goBack();
});

document.getElementById("details-back-btn").addEventListener("click", () => {
    goBack();
});

document.getElementById("help-back-btn").addEventListener("click", () => {
    goBack();
});

document.getElementById("message-back-btn").addEventListener("click", () => {
    goBack();
});

searchBtn.addEventListener("click", () => {
    const query = searchInput.value.trim();

    if (!query) {
        showMessage(
            "Search Required",
            "Please enter a book title, author, or topic."
        );
        return;
    }

    startSearch(query);
});

searchInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        const query = searchInput.value.trim();

        if (!query) {
            showMessage(
                "Search Required",
                "Please enter a book title, author, or topic."
            );
            return;
        }

        startSearch(query);
    }
});

document.querySelectorAll(".topic-btn").forEach(button => {
    button.addEventListener("click", () => {
        const topic = button.dataset.topic;

        startSearch(topic);
    });
});

favoriteStatusFilter.addEventListener("change", () => {
    renderFavorites();
});

async function startSearch(query) {
    showLoading();

    try {
        const books = await getBooks(query);

        resultsTitle.textContent = `Results for "${query}"`;

        renderResults(books);

        showPage(resultsPage);
    } catch (error) {
        showMessage(
            "Something went wrong",
            "Unable to find books right now. Please try again."
        );
    }
}

async function getBooks(query) {
    const url =
        `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=20`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Search request failed");
    }

    const data = await response.json();

    return data.docs || [];
}

async function getGenreBooks(genre) {
    const subject = encodeURIComponent(
        genre.toLowerCase().replace(/\s+/g, "_")
    );

    const url =
        `https://openlibrary.org/subjects/${subject}.json?limit=20`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Genre request failed");
    }

    const data = await response.json();

    return (data.works || []).map(book => ({
        key: book.key,
        title: book.title,
        author_name: book.authors
            ? book.authors.map(author => author.name)
            : [],
        cover_i: book.cover_id,
        first_publish_year: book.first_publish_year
    }));
}

function getBookCover(book) {
    if (book.cover_i) {
        return `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`;
    }

    if (book.cover_id) {
        return `https://covers.openlibrary.org/b/id/${book.cover_id}-M.jpg`;
    }

    return "https://via.placeholder.com/150x220?text=No+Cover";
}

function getAuthor(book) {
    if (book.author_name && book.author_name.length > 0) {
        return book.author_name.join(", ");
    }

    return "Unknown Author";
}

function getBookKey(book) {
    return book.key || "";
}

function createBookCard(book) {
    const card = document.createElement("div");

    card.className = "book-card";

    const cover = document.createElement("img");

    cover.src = getBookCover(book);
    cover.alt = book.title || "Book Cover";

    const info = document.createElement("div");

    info.className = "book-card-info";

    const title = document.createElement("h2");

    title.textContent =
        book.title || "Unknown Title";

    const author = document.createElement("p");

    author.textContent =
        `Author: ${getAuthor(book)}`;

    const year = document.createElement("p");

    year.textContent =
        `Published: ${book.first_publish_year || "Unknown"}`;

    const buttons = document.createElement("div");

    buttons.className = "book-card-buttons";

    const detailsButton = document.createElement("button");

    detailsButton.textContent = "View Details";

    detailsButton.addEventListener("click", () => {
        showDetails(book);
    });

    const favoriteButton = document.createElement("button");

    if (getFavorite(book)) {
        favoriteButton.textContent = "View Favorite";
    } else {
        favoriteButton.textContent = "Add to Favorites";
    }

    favoriteButton.addEventListener("click", () => {
        showDetails(book);

        setTimeout(() => {
            favoriteStatusContainer.classList.remove("hidden");
        }, 100);
    });

    buttons.appendChild(detailsButton);
    buttons.appendChild(favoriteButton);

    info.appendChild(title);
    info.appendChild(author);
    info.appendChild(year);
    info.appendChild(buttons);

    card.appendChild(cover);
    card.appendChild(info);

    return card;
}

function renderResults(books) {
    resultsList.innerHTML = "";

    if (!books || books.length === 0) {
        resultsList.innerHTML = `
            <div class="no-results">
                <h2>No books found</h2>
                <p>Try searching for another title, author, or topic.</p>
            </div>
        `;

        return;
    }

    books.forEach(book => {
        resultsList.appendChild(createBookCard(book));
    });
}

async function showDetails(book) {
    currentBook = book;

    bookTitle.textContent =
        book.title || "Unknown Title";

    bookAuthor.textContent =
        getAuthor(book);

    bookPublisher.textContent =
        "Loading...";

    bookDate.textContent =
        book.first_publish_year || "Unknown";

    bookPages.textContent =
        "Loading...";

    bookDescription.textContent =
        "Loading description...";

    bookGenres.innerHTML =
        "<span>Loading genres...</span>";

    bookCover.src =
        getBookCover(book);

    const workKey =
        getBookKey(book);

    if (workKey) {
        openBookBtn.href =
            `https://openlibrary.org${workKey}`;
    } else {
        openBookBtn.href =
            "https://openlibrary.org";
    }

    updateFavoriteButton();

    favoriteStatusContainer.classList.add("hidden");

    if (getFavorite(book)) {
        favoriteStatusContainer.classList.remove("hidden");
    }

    showPage(detailsPage);

    await loadBookDetails(book);
}

async function loadBookDetails(book) {
    const workKey =
        getBookKey(book);

    if (!workKey) {
        bookPublisher.textContent =
            "Unknown";

        bookPages.textContent =
            "Unknown";

        bookGenres.innerHTML =
            "<span>No genres available</span>";

        bookDescription.textContent =
            "No description available.";

        return;
    }

    try {
        const response = await fetch(
            `https://openlibrary.org${workKey}.json`
        );

        if (!response.ok) {
            throw new Error("Details request failed");
        }

        const work =
            await response.json();

        const publishers =
            work.publishers || [];

        bookPublisher.textContent =
            publishers.length > 0
                ? publishers.join(", ")
                : "Unknown";

        bookPages.textContent =
            work.number_of_pages ||
            book.number_of_pages_median ||
            "Unknown";

        const genres =
            getWorkGenres(work, book);

        renderGenres(genres);

        bookDescription.textContent =
            getDescription(work);

        saveLoadedDetails(
            book,
            work,
            genres
        );

        updateFavoriteButton();

    } catch (error) {

        bookPublisher.textContent =
            "Unknown";

        bookPages.textContent =
            book.number_of_pages_median ||
            "Unknown";

        renderGenres(
            getFallbackGenres(book)
        );

        bookDescription.textContent =
            "No description available.";
    }
}

function getWorkGenres(work, book) {
    const subjects =
        work.subjects || [];

    const genres = subjects
        .map(subject => {

            if (typeof subject === "string") {
                return subject;
            }

            if (subject && subject.name) {
                return subject.name;
            }

            return "";
        })
        .filter(Boolean)
        .map(subject => subject.trim())
        .filter(subject => subject.length > 0);

    const uniqueGenres =
        [...new Set(genres)];

    if (uniqueGenres.length > 0) {
        return uniqueGenres.slice(0, 15);
    }

    return getFallbackGenres(book);
}

function getFallbackGenres(book) {
    const subjects =
        book.subject || [];

    if (!Array.isArray(subjects)) {
        return [];
    }

    return [
        ...new Set(
            subjects
                .map(subject => String(subject).trim())
                .filter(Boolean)
        )
    ].slice(0, 15);
}

function renderGenres(genres) {
    bookGenres.innerHTML = "";

    if (!genres || genres.length === 0) {
        bookGenres.innerHTML =
            "<span>No genres available</span>";

        return;
    }

    genres.forEach(genre => {

        const button =
            document.createElement("button");

        button.className =
            "genre-btn";

        button.textContent =
            genre;

        button.addEventListener("click", async () => {

            showLoading();

            try {

                const books =
                    await getGenreBooks(genre);

                resultsTitle.textContent =
                    `Books in "${genre}"`;

                renderResults(books);

                showPage(resultsPage);

            } catch (error) {

                showMessage(
                    "Genre Unavailable",
                    "Unable to load books from this genre right now."
                );
            }
        });

        bookGenres.appendChild(button);
    });
}

function getDescription(work) {
    if (!work.description) {
        return "No description available.";
    }

    if (typeof work.description === "string") {
        return work.description;
    }

    if (work.description.value) {
        return work.description.value;
    }

    return "No description available.";
}

function saveLoadedDetails(book, work, genres) {
    const favorite =
        getFavorite(book);

    if (!favorite) {
        return;
    }

    const favorites =
        getFavorites();

    const updatedFavorites =
        favorites.map(item => {

            if (
                getBookKey(item) !==
                getBookKey(book)
            ) {
                return item;
            }

            return {
                ...item,
                publisher: work.publishers
                    ? work.publishers.join(", ")
                    : item.publisher,
                pages:
                    work.number_of_pages ||
                    item.pages ||
                    book.number_of_pages_median,
                description:
                    getDescription(work),
                genres: genres
            };
        });

    saveFavorites(updatedFavorites);
}

function getFavorites() {
    try {

        const favorites =
            JSON.parse(
                localStorage.getItem(
                    "bookFavorites"
                )
            );

        return Array.isArray(favorites)
            ? favorites
            : [];

    } catch {

        return [];
    }
}

function saveFavorites(favorites) {
    localStorage.setItem(
        "bookFavorites",
        JSON.stringify(favorites)
    );
}

function getFavorite(book) {
    const favorites =
        getFavorites();

    const key =
        getBookKey(book);

    return favorites.find(
        item =>
            getBookKey(item) === key
    );
}

function saveFavorite() {
    if (!currentBook) {
        return;
    }

    const favorites =
        getFavorites();

    const existingIndex =
        favorites.findIndex(
            item =>
                getBookKey(item) ===
                getBookKey(currentBook)
        );

    const favoriteBook = {
        ...currentBook,
        status:
            favoriteStatus.value
    };

    if (existingIndex >= 0) {

        favorites[existingIndex] = {
            ...favorites[existingIndex],
            ...favoriteBook
        };

    } else {

        favorites.push(
            favoriteBook
        );
    }

    saveFavorites(favorites);

    updateFavoriteButton();

    favoriteStatusContainer.classList.remove(
        "hidden"
    );

    removeFavoriteBtn.classList.remove(
        "hidden"
    );

    saveFavoriteBtn.textContent =
        "Saved";
}

function removeFavorite() {
    if (!currentBook) {
        return;
    }

    const favorites =
        getFavorites();

    const updatedFavorites =
        favorites.filter(
            item =>
                getBookKey(item) !==
                getBookKey(currentBook)
        );

    saveFavorites(updatedFavorites);

    favoriteStatusContainer.classList.add(
        "hidden"
    );

    updateFavoriteButton();

    renderFavorites();
}

function updateFavoriteStatus(
    bookKey,
    status
) {
    const favorites =
        getFavorites();

    const updatedFavorites =
        favorites.map(book => {

            if (
                getBookKey(book) ===
                bookKey
            ) {
                return {
                    ...book,
                    status: status
                };
            }

            return book;
        });

    saveFavorites(updatedFavorites);
}

function updateFavoriteButton() {
    if (!currentBook) {
        return;
    }

    const favorite =
        getFavorite(currentBook);

    if (favorite) {

        favoriteBtn.textContent =
            "Favorite Saved";

        favoriteStatus.value =
            favorite.status ||
            "Want to Read";

        removeFavoriteBtn.classList.remove(
            "hidden"
        );

    } else {

        favoriteBtn.textContent =
            "Add to Favorites";

        favoriteStatus.value =
            "Want to Read";

        removeFavoriteBtn.classList.add(
            "hidden"
        );
    }
}

function renderFavorites() {
    favoritesList.innerHTML = "";

    const favorites =
        getFavorites();

    const selectedStatus =
        favoriteStatusFilter.value;

    const filteredFavorites =
        selectedStatus === "All"
            ? favorites
            : favorites.filter(
                book =>
                    (book.status ||
                        "Want to Read") ===
                    selectedStatus
            );

    if (filteredFavorites.length === 0) {

        favoritesList.innerHTML = `
            <div class="no-results">
                <h2>No favorite books</h2>
                <p>Add books to your favorites to see them here.</p>
            </div>
        `;

        return;
    }

    filteredFavorites.forEach(book => {

        const card =
            createFavoriteCard(book);

        favoritesList.appendChild(card);
    });
}

function createFavoriteCard(book) {
    const card =
        document.createElement("div");

    card.className =
        "book-card";

    const cover =
        document.createElement("img");

    cover.src =
        getBookCover(book);

    cover.alt =
        book.title ||
        "Book Cover";

    const info =
        document.createElement("div");

    info.className =
        "book-card-info";

    const title =
        document.createElement("h2");

    title.textContent =
        book.title ||
        "Unknown Title";

    const author =
        document.createElement("p");

    author.textContent =
        `Author: ${getAuthor(book)}`;

    const statusLabel =
        document.createElement("span");

    statusLabel.className =
        "favorite-status-label";

    statusLabel.textContent =
        book.status ||
        "Want to Read";

    const statusControl =
        document.createElement("div");

    statusControl.className =
        "favorite-status-control";

    const statusSelect =
        document.createElement("select");

    const statuses = [
        "Want to Read",
        "Reading",
        "Completed",
        "On Hold"
    ];

    statuses.forEach(status => {

        const option =
            document.createElement("option");

        option.value =
            status;

        option.textContent =
            status;

        if (
            (book.status ||
                "Want to Read") ===
            status
        ) {
            option.selected = true;
        }

        statusSelect.appendChild(
            option
        );
    });

    const updateButton =
        document.createElement("button");

    updateButton.textContent =
        "Update";

    updateButton.addEventListener(
        "click",
        () => {

            updateFavoriteStatus(
                getBookKey(book),
                statusSelect.value
            );

            statusLabel.textContent =
                statusSelect.value;
        }
    );

    statusControl.appendChild(
        statusSelect
    );

    statusControl.appendChild(
        updateButton
    );

    const buttons =
        document.createElement("div");

    buttons.className =
        "book-card-buttons";

    const detailsButton =
        document.createElement("button");

    detailsButton.textContent =
        "View Details";

    detailsButton.addEventListener(
        "click",
        () => {
            showDetails(book);
        }
    );

    const removeButton =
        document.createElement("button");

    removeButton.textContent =
        "Remove Favorite";

    removeButton.addEventListener(
        "click",
        () => {

            const favorites =
                getFavorites();

            const updatedFavorites =
                favorites.filter(
                    item =>
                        getBookKey(item) !==
                        getBookKey(book)
                );

            saveFavorites(
                updatedFavorites
            );

            renderFavorites();
        }
    );

    buttons.appendChild(
        detailsButton
    );

    buttons.appendChild(
        removeButton
    );

    info.appendChild(title);
    info.appendChild(author);
    info.appendChild(statusLabel);
    info.appendChild(statusControl);
    info.appendChild(buttons);

    card.appendChild(cover);
    card.appendChild(info);

    return card;
}

favoriteBtn.addEventListener(
    "click",
    () => {

        const favorite =
            getFavorite(currentBook);

        if (favorite) {

            favoriteStatusContainer.classList.remove(
                "hidden"
            );

            return;
        }

        favoriteStatusContainer.classList.remove(
            "hidden"
        );

        removeFavoriteBtn.classList.add(
            "hidden"
        );

        saveFavoriteBtn.textContent =
            "Save to Favorites";
    }
);

saveFavoriteBtn.addEventListener(
    "click",
    () => {
        saveFavorite();
    }
);

removeFavoriteBtn.addEventListener(
    "click",
    () => {
        removeFavorite();
    }
);