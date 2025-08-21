/*
 * Global utility functions and data for the Simply Invest application.
 *
 * This file implements user authentication, stock simulation and AI lessons.
 * User data is stored in localStorage for demonstration purposes. In a real
 * application you would use a server-side database and proper security.
 */

// Helper to compute SHA-256 hash of a password. Returns a hex string.
async function hashPassword(password) {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Retrieve the array of users from localStorage
function getUsers() {
  return JSON.parse(localStorage.getItem('users') || '[]');
}

// Persist the array of users to localStorage
function saveUsers(users) {
  localStorage.setItem('users', JSON.stringify(users));
}

// Register a new user
async function registerUser(username, age, password) {
  if (!username) {
    return { success: false, message: 'Username is required.' };
  }
  if (isNaN(age) || age < 13) {
    return { success: false, message: 'You must be at least 13 years old to register.' };
  }
  const users = getUsers();
  // check for existing username (case insensitive)
  if (users.find((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return { success: false, message: 'Username already exists.' };
  }
  const passwordHash = await hashPassword(password);
  const newUser = {
    username: username,
    age: age,
    passwordHash: passwordHash,
    coins: 100000,
    portfolio: [],
  };
  users.push(newUser);
  saveUsers(users);
  localStorage.setItem('currentUser', username);
  return { success: true };
}

// Log in an existing user
async function loginUser(username, password) {
  const users = getUsers();
  const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (!user) {
    return { success: false, message: 'User not found.' };
  }
  const hash = await hashPassword(password);
  if (hash !== user.passwordHash) {
    return { success: false, message: 'Incorrect password.' };
  }
  localStorage.setItem('currentUser', user.username);
  return { success: true };
}

// Get the currently logged-in user's object
function getCurrentUserObject() {
  const username = localStorage.getItem('currentUser');
  if (!username) return null;
  const users = getUsers();
  return users.find((u) => u.username === username) || null;
}

// Update a user object in the stored users list
function updateUser(updatedUser) {
  const users = getUsers();
  const idx = users.findIndex((u) => u.username === updatedUser.username);
  if (idx >= 0) {
    users[idx] = updatedUser;
    saveUsers(users);
  }
}

// Log out the current user
function logout() {
  localStorage.removeItem('currentUser');
  window.location.href = 'index.html';
}

// List of available stocks (symbol and name)
function getStocks() {
  return [
    { symbol: 'AAPL', name: 'Apple Inc.' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.' },
    { symbol: 'TSLA', name: 'Tesla Inc.' },
    { symbol: 'GOOG', name: 'Alphabet Inc.' },
    { symbol: 'NFLX', name: 'Netflix Inc.' },
    { symbol: 'NVDA', name: 'Nvidia Corp.' },
    { symbol: 'MSFT', name: 'Microsoft Corp.' },
    { symbol: 'META', name: 'Meta Platforms Inc.' },
  ];
}

// Retrieve cached stock prices from localStorage
function getStockPrices() {
  return JSON.parse(localStorage.getItem('stockPrices') || '{}');
}

// Persist stock prices to localStorage
function saveStockPrices(prices) {
  localStorage.setItem('stockPrices', JSON.stringify(prices));
}

// Get the current price of a stock symbol. If not present, use base price.
function getStockPrice(symbol) {
  let prices = getStockPrices();
  if (!prices[symbol]) {
    const base = {
      AAPL: 150,
      AMZN: 3200,
      TSLA: 700,
      GOOG: 2800,
      NFLX: 500,
      NVDA: 450,
      MSFT: 350,
      META: 300,
    };
    prices[symbol] = base[symbol] || 100;
    saveStockPrices(prices);
  }
  return prices[symbol];
}

// Update a single stock price with a random variation and return the new price
function updateStockPrice(symbol) {
  let prices = getStockPrices();
  let price = prices[symbol];
  if (!price) {
    price = getStockPrice(symbol);
  }
  // apply a random variation between -5% and +5%
  const variation = Math.random() * 0.1 - 0.05;
  let newPrice = price * (1 + variation);
  if (newPrice < 1) newPrice = 1;
  prices[symbol] = parseFloat(newPrice.toFixed(2));
  saveStockPrices(prices);
  return prices[symbol];
}

// Invest a certain amount of coins into a stock symbol
function investCoins(symbol, amount) {
  let user = getCurrentUserObject();
  if (!user) return { success: false, message: 'Not logged in.' };
  amount = parseFloat(amount);
  if (isNaN(amount) || amount <= 0) {
    return { success: false, message: 'Please enter a valid amount.' };
  }
  if (amount > user.coins) {
    return { success: false, message: 'You do not have enough coins.' };
  }
  const price = getStockPrice(symbol);
  const quantity = amount / price;
  const investment = {
    symbol: symbol,
    quantity: quantity,
    priceAtPurchase: price,
    investedAmount: amount,
  };
  user.coins = parseFloat((user.coins - amount).toFixed(2));
  user.portfolio.push(investment);
  updateUser(user);
  return { success: true, price: price, quantity: quantity };
}

// Update the entire portfolio: calculate new prices, update coin balance and investment amounts
function updatePortfolio() {
  let user = getCurrentUserObject();
  if (!user) return { success: false };
  user.portfolio = user.portfolio.map((inv) => {
    const newPrice = updateStockPrice(inv.symbol);
    const oldPrice = inv.priceAtPurchase;
    const pctChange = (newPrice - oldPrice) / oldPrice;
    const profitLoss = inv.investedAmount * pctChange;
    user.coins = parseFloat((user.coins + profitLoss).toFixed(2));
    // update investment base for next calculation
    inv.priceAtPurchase = newPrice;
    inv.investedAmount = inv.quantity * newPrice;
    return inv;
  });
  updateUser(user);
  return { success: true };
}

// Sell a specific investment by its index
function sellInvestment(index) {
  let user = getCurrentUserObject();
  if (!user) return { success: false };
  if (index < 0 || index >= user.portfolio.length) return { success: false };
  const inv = user.portfolio[index];
  // update the price before selling
  const currentPrice = updateStockPrice(inv.symbol);
  const value = inv.quantity * currentPrice;
  user.coins = parseFloat((user.coins + value).toFixed(2));
  user.portfolio.splice(index, 1);
  updateUser(user);
  return { success: true, value: value };
}

// Lessons data used in the AI tutorial page
const lessons = [
  {
    title: 'Step 1: Decide if you want to invest on your own or with help',
    text:
      'There are different ways to approach stock investing. You can choose to pick stocks and funds yourself or rely on a robo-advisor that invests for you. Consider how hands-on you want to be when deciding between doing it yourself or getting help.',
  },
  {
    title: 'Step 2: Choose a broker or robo-advisor',
    text:
      'If you choose to invest on your own, evaluate brokers based on costs, investment selection, research tools and customer service. If you opt for a robo-advisor, compare fees and services to pick one that meets your needs.',
  },
  {
    title: 'Step 3: Pick a type of investment account',
    text:
      'Investment accounts include standard brokerage accounts and tax-advantaged retirement accounts like Roth IRAs. Different accounts have different tax treatments and purposes, so select the one that fits your goals.',
  },
  {
    title: 'Step 4: Learn the difference between stocks and funds',
    text:
      'Investing doesn’t have to be complicated. Funds like mutual funds and ETFs let you buy small pieces of many companies in one transaction, providing diversification. Individual stocks can offer higher potential reward, but they carry higher risk and require more research.',
  },
  {
    title: 'Step 5: Set a budget for investing',
    text:
      'Decide how much you can afford to invest. The share price of a stock can range from a few dollars to thousands of dollars. Consider using ETFs or mutual funds if you have a small budget. Keep your investment in individual stocks to a small portion of your overall portfolio.',
  },
  {
    title: 'Step 6: Focus on the long term',
    text:
      'Stock market investments have historically returned about 10% per year on average. However, the market can be volatile in the short run. Avoid checking your portfolio daily and commit to investing for the long term.',
  },
  {
    title: 'Step 7: Manage and diversify your portfolio',
    text:
      'Check in on your investments periodically to ensure they align with your goals. Diversify across different sectors and even globally to reduce risk. Adjust your portfolio as you approach important milestones, such as retirement.',
  },
  {
    title: 'Consider the Risk',
    text:
      'Stocks can be volatile. Ask yourself how you would react to large drops in price. If you prefer less risk, consider stock funds like mutual funds or ETFs that provide diversification. Match your investments to your risk tolerance.',
  },
  {
    title: 'Diversify Your Portfolio',
    text:
      'Don’t put all your money in one company or sector. Spread your investments across different industries and asset classes, such as technology, healthcare, real estate and bonds. Diversification can reduce the impact of a single investment’s poor performance.',
  },
  {
    title: 'Understand the Commitment',
    text:
      'Investing in individual stocks requires time to research companies and monitor their performance. If your time is limited, using funds or a robo-advisor may be a better choice. Make sure you are ready for the commitment before picking your own stocks.',
  },
];
