const homePage = document.getElementById('home-page');
const loadingPage = document.getElementById('loading-page');
const resultsPage = document.getElementById('results-page');
const favoritesPage = document.getElementById('favorites-page');
const detailsPage = document.getElementById('details-page');
const helpPage = document.getElementById('help-page');
const messagePage = document.getElementById('message-page');

const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const resultsList = document.getElementById('results-list');
const favoritesList = document.getElementById('favorites-list');

const homeNav = document.getElementById('home-nav');
const favoritesNav = document.getElementById('favorites-nav');
const helpNav = document.getElementById('help-nav');

const resultsHomeBtn = document.getElementById('results-home-btn');
const favoritesHomeBtn = document.getElementById('favorites-home-btn');

const detailsBackBtn = document.getElementById('details-back-btn');
const detailsHomeBtn = document.getElementById('details-home-btn');

const helpBackBtn = document.getElementById('help-back-btn');
const messageBackBtn = document.getElementById('message-back-btn');

const favoriteBtn = document.getElementById('favorite-btn');
const openBookBtn = document.getElementById('open-book-btn');

const messageTitle = document.getElementById('message-title');
const messageText = document.getElementById('message-text');

let currentBook = null;
let previousPage = resultsPage;

function showPage(pageToShow) {
    [
        homePage,
        loadingPage,
        resultsPage,
        favoritesPage,
        detailsPage,
        helpPage,
        messagePage
    ].forEach(page => {
        page.classList.add('hidden');
    });

    pageToShow.classList.remove('hidden');
}

function showMessage(title, text) {
    messageTitle.textContent = title;
    messageText.textContent = text;

    showPage(messagePage);
}

homeNav.addEventListener('click', () => {
    showPage(homePage);
});

favoritesNav.addEventListener('click', () => {
    renderFavorites();
    showPage(favoritesPage);
});

helpNav.addEventListener('click', () => {
    showPage(helpPage);
});

resultsHomeBtn.addEventListener('click', () => {
    showPage(homePage);
});

favoritesHomeBtn.addEventListener('click', () => {
    showPage(homePage);
});

detailsHomeBtn.addEventListener('click', () => {
    showPage(homePage);
});

detailsBackBtn.addEventListener('click', () => {
    showPage(previousPage);
});

helpBackBtn.addEventListener('click', () => {
    showPage(homePage);
});

messageBackBtn.addEventListener('click', () => {
    showPage(homePage);
});

searchBtn.addEventListener('click', () => {
    startSearch(searchInput.value);
});

searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        startSearch(searchInput.value);
    }
});

document.querySelectorAll('.topic-btn').forEach(button => {
    button.addEventListener('click', e => {
        const topic = e.target.getAttribute('data-topic');

        searchInput.value = topic;

        startSearch(topic);
    });
});

favoriteBtn.addEventListener('click', () => {
    if (!currentBook) {
        return;
    }

    toggleFavorite(currentBook);

    updateFavoriteButton();
});

function startSearch(query) {
    const cleanQuery = query.trim();

    if (!cleanQuery) {
        showMessage(
            'Input Required',
            'Please type a keyword to search for books.'
        );

        return;
    }

    getBooks(cleanQuery);
}

function getBooks(query) {
    showPage(loadingPage);

    const url =
        `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10`;

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch book data.');
            }

            return response.json();
        })
        .then(data => {
            if (!data.docs || data.docs.length === 0) {
                showMessage(
                    'No Results Found',
                    'No books matched your search term.'
                );

                return;
            }

            renderResults(data.docs);

            previousPage = resultsPage;

            showPage(resultsPage);
        })
        .catch(error => {
            console.error('Search Error:', error);

            showMessage(
                'Search Error',
                error.message ||
                'Something went wrong while getting book data.'
            );
        });
}

function getBookCover(book, size = 'M') {
    if (!book.cover_i) {
        return '';
    }

    return `https://covers.openlibrary.org/b/id/${book.cover_i}-${size}.jpg`;
}

function getAuthor(book) {
    if (!book.author_name) {
        return 'Unknown Author';
    }

    return book.author_name.join(', ');
}

function createBookCard(book, isFavorite = false) {
    const title = book.title || 'Untitled';

    const author = getAuthor(book);

    const cover = getBookCover(book);

    const card = document.createElement('div');

    card.className = 'book-card';

    card.innerHTML = `
        <img src="${cover}" alt="Cover">

        <div>
            <h3>${title}</h3>

            <p>
                <strong>Author:</strong>
                ${author}
            </p>

            <div class="card-buttons">

                <button class="view-btn">
                    View Details
                </button>

                ${
                    isFavorite
                    ?
                    `<button class="favorite-card-btn">
                        Remove Favorite
                    </button>`
                    :
                    `<button class="favorite-card-btn">
                        Add Favorite
                    </button>`
                }

                <a
                    href="https://openlibrary.org${book.key || ''}"
                    target="_blank"
                >
                    Open Library
                </a>

            </div>
        </div>
    `;

    card.querySelector('.view-btn').addEventListener('click', () => {
        previousPage = isFavorite ? favoritesPage : resultsPage;

        showDetails(book);
    });

    card.querySelector('.favorite-card-btn').addEventListener('click', () => {
        toggleFavorite(book);

        if (isFavorite) {
            renderFavorites();
        } else {
            renderResults(window.lastResults || []);
        }
    });

    return card;
}

function renderResults(books) {
    window.lastResults = books;

    resultsList.innerHTML = '';

    books.forEach(book => {
        const card = createBookCard(book);

        resultsList.appendChild(card);
    });
}

function renderFavorites() {
    const favorites = getFavorites();

    favoritesList.innerHTML = '';

    if (favorites.length === 0) {
        favoritesList.innerHTML = `
            <div class="empty-message">
                <h2>No Favorite Books</h2>
                <p>
                    You haven't added any books to your favorites yet.
                </p>
            </div>
        `;

        return;
    }

    favorites.forEach(book => {
        const card = createBookCard(book, true);

        favoritesList.appendChild(card);
    });
}

function showDetails(book) {
    currentBook = book;

    document.getElementById('book-title').textContent =
        book.title || 'Untitled';

    document.getElementById('book-author').textContent =
        getAuthor(book);

    document.getElementById('book-publisher').textContent =
        book.publisher
            ? book.publisher[0]
            : 'N/A';

    document.getElementById('book-date').textContent =
        book.first_publish_year || 'N/A';

    document.getElementById('book-pages').textContent =
        book.number_of_pages_median || 'N/A';

    document.getElementById('book-cover').src =
        getBookCover(book, 'L');

    document.getElementById('book-description').textContent =
        'No description available.';

    openBookBtn.href =
        `https://openlibrary.org${book.key || ''}`;

    updateFavoriteButton();

    showPage(detailsPage);
}

function getFavorites() {
    const favorites =
        localStorage.getItem('bookFavorites');

    if (!favorites) {
        return [];
    }

    return JSON.parse(favorites);
}

function saveFavorites(favorites) {
    localStorage.setItem(
        'bookFavorites',
        JSON.stringify(favorites)
    );
}

function isFavorite(book) {
    const favorites = getFavorites();

    return favorites.some(favorite => {
        return favorite.key === book.key;
    });
}

function toggleFavorite(book) {
    let favorites = getFavorites();

    const exists = favorites.some(favorite => {
        return favorite.key === book.key;
    });

    if (exists) {
        favorites = favorites.filter(favorite => {
            return favorite.key !== book.key;
        });
    } else {
        favorites.push(book);
    }

    saveFavorites(favorites);
}

function updateFavoriteButton() {
    if (!currentBook) {
        return;
    }

    if (isFavorite(currentBook)) {
        favoriteBtn.textContent = 'Remove from Favorites';
    } else {
        favoriteBtn.textContent = 'Add to Favorites';
    }
}