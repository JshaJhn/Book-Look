==================================================
                    BOOK LOOK
        A Cozy Library-Themed Book Finder
==================================================


PROJECT TITLE
-------------
Book Look


MEMBERS
-------
1. Fenie Marie S. Dilao
2. John Joshua D. Quiriones


SHORT PROJECT DESCRIPTION
-------------------------
Book Look is a web application that helps users discover books in a
cozy, magical library-themed space. Users can search millions of books
by title, author, or genre, browse the New York Times Best Seller lists,
and view book details such as the description, publisher, page count,
rating, and genres.

Users can save books to their Favorites, give each one a reading status
(Want to Read, Reading, Completed, On Hold), and organize them into
their own custom categories. With a free account, favorites are saved
in an online database and can be accessed from any device.


DEPLOYED WEBSITE LINK
---------------------
(https://jshajhn.github.io/Book-Look/)

GitHub Repository: (https://github.com/JshaJhn/Book-Look.git)


INSTRUCTIONS FOR ACCESSING / USING THE WEBSITE
----------------------------------------------
Accessing the website:
  1. Open the deployed link above in any modern browser
     (Chrome, Edge, Firefox, or Safari). Works on phones and computers.
  2. No installation is needed.

Searching for books:
  1. Type a book title, author, or genre in the search bar.
  2. Use the dropdown beside the search bar to search by
     Everything, Title, Author, or Genre.
  3. Press Enter or click "Search".
  4. You can also click a genre button (Fantasy, Mystery, Romance, etc.)
     under the search bar to see books from that genre.
  5. Click "Load more books" at the bottom to see more results.

Popular books:
  1. On the home page, scroll to "Popular This Week".
  2. Switch between Fiction, Nonfiction, and Young Adult.
  3. The list updates weekly from the New York Times Best Sellers.

Viewing book details:
  1. Click a book cover or "View Details".
  2. See the description, publisher, publish date, pages, rating,
     and genres.
  3. Click a genre tag to find similar books.
  4. Click "View on Google Books" to open the book's Google Books page.

Favorites:
  1. Click the heart (♡) on a book, or "Add to Favorites" on its
     details page.
  2. Choose a Reading Status and a Category, then click
     "Save to Favorites".
  3. Open the "Favorites" page from the top menu to see your saved books.
  4. Filter by category, by status, or search within your favorites.
  5. Click "＋ New Category" to create your own category.
  6. Change a book's status or category anytime, or click "Remove".

Accounts (optional):
  1. Click "☁ Sign In" in the top menu.
  2. Enter an email and a password (at least 6 characters), then click
     "Create Account". Use "Sign In" next time.
  3. Signed in, your favorites are saved online and appear on any device.
  4. Without an account, favorites are saved only in your current browser.

Running the project locally (for developers):
  1. Download or clone this repository.
  2. Open the folder in Visual Studio Code.
  3. Install the "Live Server" extension.
  4. Right-click index.html and choose "Open with Live Server".


API USED
--------
1. Google Books API
   - Used for searching books by title, author, and genre, and for
     book details (description, cover, publisher, pages, rating,
     categories).
   - https://developers.google.com/books

2. New York Times Books API
   - Used for the "Popular This Week" section (NYT Best Seller lists).
   - https://developer.nytimes.com/docs/books-product/1/overview

3. Supabase (Database and Authentication)
   - Used for user accounts and for storing each user's favorites
     and categories in an online PostgreSQL database.
   - Row Level Security makes sure users can only see and edit their
     own data.
   - https://supabase.com


OTHER IMPORTANT INFORMATION
---------------------------
Technologies used:
  - HTML5, CSS3, JavaScript (no frameworks)
  - Google Fonts: Cormorant Garamond and Lora
  - Supabase JavaScript Library (via jsDelivr CDN)

Project files:
  - index.html            Page structure and layout
  - style.css             Cozy library design and animations
  - app.js                Search, popular books, favorites, categories,
                          and database logic
  - config.js             API keys and database settings
  - supabase-schema.sql   Database tables and security rules
  - images/               Background image
