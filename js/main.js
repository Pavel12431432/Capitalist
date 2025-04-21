import { GameAPI } from "./game_api.js";
import { eventManager } from "./event_manager.js";
import { showNotification } from "./notification_system.js";
import { ComputerPlayer } from "./computer_player.js";
import { startTime, setTrigger, updateProgressBar } from "./time_manager.js";
import {
    loadAllHistoricalData,
    historicalData,
    getHistoricalPrice,
} from "./data_manager.js";

// =======================
// Utility Functions (global)
// =======================

let portfolioChart = null;

// stats
let tradeCount = 0;

function initPortfolioChart() {
    if (portfolioChart) {
        portfolioChart.destroy();
    }

    const ctx = document.getElementById("portfolioChart").getContext("2d");

    portfolioChart = new Chart(ctx, {
        type: "pie",
        data: {
            labels: [
                "Stocks",
                "Bonds",
                "Savings",
                "Index Fund",
                "Gold",
                "Oil",
                "Cash",
            ],
            datasets: [
                {
                    data: [0, 0, 0, 0, 0], // placeholder
                    backgroundColor: [
                        getComputedStyle(document.documentElement)
                            .getPropertyValue("--chart-stock")
                            .trim(),
                        getComputedStyle(document.documentElement)
                            .getPropertyValue("--chart-bond")
                            .trim(),
                        getComputedStyle(document.documentElement)
                            .getPropertyValue("--chart-savings")
                            .trim(),
                        getComputedStyle(document.documentElement)
                            .getPropertyValue("--chart-index")
                            .trim(),
                        getComputedStyle(document.documentElement)
                            .getPropertyValue("--chart-gold")
                            .trim(),
                        getComputedStyle(document.documentElement)
                            .getPropertyValue("--chart-oil")
                            .trim(),
                        getComputedStyle(document.documentElement)
                            .getPropertyValue("--chart-cash")
                            .trim(),
                    ],
                    borderWidth: 0,
                },
            ],
        },
        options: {
            responsive: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) =>
                            `${context.label}: ${context.parsed.toFixed(2)}%`,
                    },
                },
            },
        },
    });
}

function updatePortfolioChart(state) {
    const stockValue = Object.values(state.stocks).reduce(
        (sum, s) => sum + s.shares * s.price,
        0
    );
    const bondValue = game.getBondValue();
    const savings = state.savings;
    const indexFund = state.indexFund.price * state.indexFund.shares;
    const oil = state.oil.barrels * state.oil.price;
    const gold = state.gold.balance;
    const cash = state.cash;

    const total =
        stockValue + bondValue + savings + indexFund + gold + oil + cash;

    const percentages = [
        (stockValue / total) * 100,
        (bondValue / total) * 100,
        (savings / total) * 100,
        (indexFund / total) * 100,
        (gold / total) * 100,
        (oil / total) * 100,
        (cash / total) * 100,
    ];

    portfolioChart.data.datasets[0].data = percentages;
    portfolioChart.update();
}

function createGameWithAutoUI(GameAPIClass, updateCallback) {
    const instance = new GameAPIClass();
    const mutatingMethods = [
        "depositToSavings",
        "withdrawFromSavings",
        "buyStock",
        "sellStock",
        "buyGold",
        "sellGold",
        "buyIndexFund",
        "sellIndexFund",
        "buyBond",
        "buyOil",
        "sellOil",
        "advanceQuarter",
        // Add others as needed
    ];

    const tradingMethods = [
        "buyStock",
        "sellStock",
        "buyGold",
        "sellGold",
        "buyIndexFund",
        "sellIndexFund",
        "buyOil",
        "sellOil",
    ];

    return new Proxy(instance, {
        get(target, prop) {
            const orig = target[prop];
            if (typeof orig === "function" && mutatingMethods.includes(prop)) {
                return function (...args) {
                    try {
                        const result = orig.apply(target, args); // ← run the real method
                        if (tradingMethods.includes(prop)) {
                            tradeCount++; // ← only increment on success
                        }
                        updateCallback();
                        return result;
                    } catch (err) {
                        // no tradeCount++ here, just re‑throw
                        throw err;
                    }
                };
            }
            return orig;
        },
    });
}

function createBondPieChart(canvasId, percentComplete, fillColor, labelText) {
    const ctx = document.getElementById(canvasId).getContext("2d");

    new Chart(ctx, {
        type: "doughnut",
        data: {
            datasets: [
                {
                    data: [percentComplete, 1 - percentComplete],
                    backgroundColor: [fillColor, "#ddd"],
                    borderWidth: 1,
                },
            ],
        },
        options: {
            animation: false,
            cutout: "55%",
            spacing: 0,
            responsive: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false },
            },
        },
        // plugins: [createLabelPlugin(labelText)],
    });
}

function createInputFlow({
    type,
    button, // depositBtn or withdrawBtn
    siblingButton, // the other one
    container,
    defaultValue,
    onSubmit,
}) {
    let inputActive = false;
    let inputEl, cancelBtn, maxBtn, wrapper;

    button.addEventListener("click", () => {
        if (!inputActive) {
            wrapper = document.createElement("div");
            wrapper.className = "input-wrapper";

            inputEl = document.createElement("input");
            inputEl.type = "number";
            inputEl.className = "savings-input";
            inputEl.placeholder = "$";

            maxBtn = document.createElement("span");
            maxBtn.textContent = "MAX";
            maxBtn.className = "max-label";
            maxBtn.addEventListener("click", () => {
                inputEl.value =
                    typeof defaultValue === "function"
                        ? defaultValue()
                        : defaultValue;
            });

            cancelBtn = document.createElement("button");
            cancelBtn.textContent = "✖";
            cancelBtn.className = "shadow-button small";
            cancelBtn.style.minWidth = "36px";
            cancelBtn.style.height = "36px";
            cancelBtn.addEventListener("click", closeFlow);

            // Keyboard support
            inputEl.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    submitFlow();
                } else if (e.key === "Escape") {
                    closeFlow();
                }
            });

            wrapper.appendChild(maxBtn);
            wrapper.appendChild(inputEl);
            container.insertBefore(cancelBtn, button);
            container.insertBefore(wrapper, button);

            siblingButton.style.display = "none";
            // button.style.transform = "translateX(20px)";
            inputActive = true;
            setTimeout(() => inputEl.focus(), 0); // Autofocus
        } else {
            submitFlow();
        }
    });

    function submitFlow() {
        const raw = inputEl.value.trim();
        if (raw === "" || isNaN(parseFloat(raw))) {
            closeFlow();
            return;
        }

        const value = parseFloat(raw);

        if (value <= 0) {
            showNotification("Enter a positive amount.", "error");
            return;
        }

        onSubmit(value);

        closeFlow();
    }

    function closeFlow() {
        inputEl.remove();
        maxBtn.remove();
        cancelBtn.remove();
        wrapper.remove();
        siblingButton.style.display = "inline-block";
        inputActive = false;
    }
}

function setupStockCard(card) {
    const quantityButtons = card.querySelectorAll(".stock-quantities button");
    const sellBtn = card.querySelector(".stock-actions button:nth-child(1)");
    const buyBtn = card.querySelector(".stock-actions button:nth-child(2)");
    const stockName =
        card.querySelector(".stock-header")?.textContent || "Unknown Stock";

    let selectedQty = 1;

    quantityButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            quantityButtons.forEach((b) => b.classList.remove("selected"));
            btn.classList.add("selected");
            selectedQty =
                btn.textContent === "MAX" ? "MAX" : parseInt(btn.textContent);
        });

        // Preselect "1" by default
        if (btn.textContent === "1") btn.classList.add("selected");
    });

    buyBtn.addEventListener("click", () => {
        try {
            game.buyStock(stockName, selectedQty);
        } catch (err) {
            showNotification(err.message, "error");
        }
    });

    sellBtn.addEventListener("click", () => {
        try {
            game.sellStock(stockName, selectedQty);
        } catch (err) {
            showNotification(err.message, "error");
        }
    });
}

function formatCurrency(value) {
    return `$${parseFloat(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function renderBonds(bonds) {
    const container = document.querySelector(".bond-charts");
    container.innerHTML = "";

    bonds.forEach((bond, index) => {
        if (bond.redeemed) return;

        const wrapper = document.createElement("div");
        wrapper.className = "bond-chart-wrapper";

        const canvas = document.createElement("canvas");
        const chartId = `bondChart${index}`;
        canvas.id = chartId;
        canvas.className = "bond-pie";

        const value = game.calculateBondValue(bond);

        const progress = game.getBondProgress(bond); // value from 0 → 1
        const fillColor = value >= 1 ? "#4CAF50" : "#A0D995";
        const labelText = `$${value.toFixed(2)}`;

        wrapper.appendChild(canvas);

        canvas.style.cursor = "pointer"; // always pointer for UX
        canvas.addEventListener("click", () => {
            try {
                game.redeemBond(index); // this throws if not matured
                updateUI();
            } catch (err) {
                showNotification(err.message, "error"); // "Bond not matured yet." etc.
            }
        });

        container.appendChild(wrapper);

        createBondPieChart(chartId, progress, fillColor, labelText);

        const label = document.createElement("div");
        label.className = "bond-label";
        label.textContent = `$${value.toFixed(2)}`;
        label.style.pointerEvents = "auto";
        label.style.userSelect = "none";

        if (progress >= 1) {
            label.style.cursor = "pointer";
            label.addEventListener("click", (e) => {
                e.stopPropagation();
                try {
                    game.redeemBond(index);
                    updateUI();
                } catch (err) {
                    showNotification(err.message, "error");
                }
            });
        }

        if (progress >= 1) {
            wrapper.classList.add("bond-bob");
        } else {
            wrapper.classList.remove("bond-bob");
        }

        wrapper.style.position = "relative";
        wrapper.appendChild(label);
    });
}

// Fill progress
function updateYearProgress(percent) {
    const fill = document.querySelector(".vintage-fill");
    fill.style.width = `${percent}%`;
}

function getIndexFundHistoryData() {
    const quarter = game.currentQuarter ?? 0;
    const history = [];

    for (let i = Math.max(0, quarter - 11); i <= quarter; i++) {
        const price = getHistoricalPrice("indexFund", null, i);
        if (price != null) {
            history.push({ quarter: `Q${(i % 4) + 1}`, price });
        }
    }

    return history;
}

function getCommodityHistoryData(type) {
    const quarter = game.currentQuarter ?? 0;
    const history = [];

    for (let i = Math.max(0, quarter - 11); i <= quarter; i++) {
        const price = getHistoricalPrice("commodities", type, i);
        if (price != null) {
            history.push(price);
        }
    }

    return history;
}

function getStockHistory(name) {
    const quarter = game.currentQuarter ?? 0;
    const history = [];

    for (let i = Math.max(0, quarter - 11); i <= quarter; i++) {
        const price = getHistoricalPrice("stocks", name, i);
        if (price != null) {
            history.push(price);
        }
    }
    return history;
}

function renderCommodityChart(canvasId, type) {
    const history = getCommodityHistoryData(type);
    const ctx = document.getElementById(canvasId)?.getContext("2d");
    if (!ctx || history.length === 0) return;

    // Keep reference name clean (e.g., 'oilChart', 'goldChart')
    const chartKey = `${type}Chart`;

    // Destroy previous chart if it exists
    if (window[chartKey] instanceof Chart) {
        window[chartKey].destroy();
    }

    const first = history[0];
    const last = history[history.length - 1];
    const isUp = last >= first;

    const strokeColor = isUp ? "#38b000" : "#e63946";
    const fillColor = isUp
        ? "rgba(56, 176, 0, 0.15)"
        : "rgba(230, 57, 70, 0.15)";

    window[chartKey] = new Chart(ctx, {
        type: "line",
        data: {
            labels: history.map(() => ""),
            datasets: [
                {
                    data: history,
                    fill: true,
                    tension: 0.1,
                    borderColor: strokeColor,
                    backgroundColor: fillColor,
                    pointRadius: 0,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false },
            },
            scales: {
                x: { display: false },
                y: { display: false },
            },
        },
    });
}

function updateCommodityDisplay(type, currentPrice, previousPrice) {
    // Find the card whose header matches GOLD or OIL
    const cards = document.querySelectorAll(".wide-card");
    let container = null;

    cards.forEach((card) => {
        const header = card.querySelector(".stock-header");
        if (
            header &&
            header.textContent.trim().toUpperCase() === type.toUpperCase()
        ) {
            container = card.querySelector(".stock-price");
        }
    });

    if (!container) return;

    const priceEl = container.querySelector(".price");
    const changeEl = container.querySelector(".change");

    const diff = currentPrice - previousPrice;
    const percent = ((diff / previousPrice) * 100).toFixed(2);
    const isUp = diff >= 0;

    priceEl.textContent = `$${currentPrice.toFixed(2)}`;
    changeEl.textContent = `${isUp ? "▲" : "▼"} ${Math.abs(percent)}%`;

    container.classList.toggle("positive", isUp);
    container.classList.toggle("negative", !isUp);
}

function renderIndexFundChart() {
    const history = getIndexFundHistoryData();
    const ctx = document
        .getElementById("indexFundChartCanvas")
        .getContext("2d");

    if (window.indexFundChart) window.indexFundChart.destroy();

    const first = history[0]?.price ?? 0;
    const last = history[history.length - 1]?.price ?? 0;
    const isUp = last >= first;

    const strokeColor = isUp ? "#38b000" : "#e63946"; // green / red
    const fillColor = isUp
        ? "rgba(56, 176, 0, 0.15)"
        : "rgba(230, 57, 70, 0.15)";

    window.indexFundChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: history.map(() => ""), // empty labels
            datasets: [
                {
                    data: history.map((p) => p.price),
                    fill: true,
                    tension: 0.1,
                    borderColor: strokeColor,
                    backgroundColor: fillColor,
                    pointRadius: 0,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false },
            },
            scales: {
                x: {
                    display: false,
                },
                y: {
                    display: false,
                },
            },
        },
    });
}

function renderStockMiniChart(card, stockName) {
    const container = card.querySelector(".stock-chart");
    if (!container) return;

    // Clear old canvas
    container.innerHTML = "";
    const canvas = document.createElement("canvas");
    container.appendChild(canvas);

    const history = getStockHistory(stockName);
    if (history.length < 2) return;

    const first = history[0];
    const last = history[history.length - 1];
    const isUp = last >= first;

    const strokeColor = isUp ? "#38b000" : "#e63946";
    const fillColor = isUp
        ? "rgba(56, 176, 0, 0.15)"
        : "rgba(230, 57, 70, 0.15)";

    const ctx = canvas.getContext("2d");

    new Chart(ctx, {
        type: "line",
        data: {
            labels: history.map(() => ""),
            datasets: [
                {
                    data: history,
                    fill: true,
                    tension: 0,
                    borderColor: strokeColor,
                    backgroundColor: fillColor,
                    pointRadius: 0,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false },
            },
            scales: {
                x: { display: false },
                y: { display: false },
            },
        },
    });
}

function updateEventPaymentUI(game) {
    const eventBox = document.getElementById("event-payment");
    const eventLabel = document.getElementById("event-name-label");
    const costLabel = document.getElementById("event-cost-label");
    const payBtn = document.getElementById("pay-event-btn");

    const event = eventManager.activeEvent;

    if (
        eventManager.hasUnresolvedEvent() &&
        event?.type === "negative" &&
        eventManager.showPaymentUI // ✅ only after user clicked 'find money'
    ) {
        eventBox.classList.add("show");
        eventLabel.textContent = event.name;
        costLabel.textContent = event.cost;

        payBtn.onclick = () => {
            if (game.cash >= event.cost) {
                // 1) apply the payment
                event.effect(game);
                event.effect(computer);
                eventManager.eventCashFlow -= event.cost || 0;

                // 2) clear the event state
                eventManager.activeEvent = null;
                eventManager.triggered = false;
                eventManager.showPaymentUI = false;
                eventBox.classList.remove("show");

                // 3) restart the quarter timer from where you left off
                setTrigger(false);
                startTime();

                // 4) refresh everything
                updateUI();
            } else {
                showNotification("You don't have enough cash.", "error");
            }
        };
    } else {
        eventBox.classList.remove("show");
    }
}

function updateUI() {
    const state = game.getGameState();

    updateEventPaymentUI(game);

    const quarter = state.currentQuarter ?? 0;
    const year = Math.floor(quarter / 4) + 1;
    document.querySelector(".year .big").textContent = year;

    // Sidebar
    document.getElementById("cash-value").textContent = formatCurrency(
        state.cash
    );
    document.getElementById("net-worth-value").textContent = formatCurrency(
        state.netWorth
    );

    // Main cards
    // savings
    document.getElementById("savings-value").textContent = formatCurrency(
        state.savings
    );

    // index fund
    document.getElementById("index-fund-value").textContent = formatCurrency(
        state.indexFund.shares * state.indexFund.price
    );
    renderIndexFundChart();

    // gold
    document.getElementById("gold-balance").textContent = formatCurrency(
        state.gold.balance
    );
    renderCommodityChart("goldChartCanvas", "gold");
    updateCommodityDisplay(
        "gold",
        state.gold.price,
        game.previousPrices?.gold ?? state.gold.price
    );

    const goldProfit = game.getGoldProfit();
    const goldCard = [...document.querySelectorAll(".wide-card")].find(
        (card) =>
            card.querySelector(".stock-header")?.textContent.trim() === "GOLD"
    );

    const goldProfitEl = goldCard?.querySelector(".stat .value");
    if (goldProfitEl) {
        goldProfitEl.textContent = formatCurrency(goldProfit);
    }

    // oil
    document.getElementById("oil-balance").textContent = formatCurrency(
        state.oil.barrels * state.oil.price
    );
    document.getElementById("oil-barrels").textContent = `${state.oil.barrels}`;
    renderCommodityChart("oilChartCanvas", "oil");
    updateCommodityDisplay(
        "oil",
        state.oil.price,
        game.previousPrices?.oil ?? state.oil.price
    );
    const oilProfit = game.getOilProfit();
    const oilCard = [...document.querySelectorAll(".wide-card")].find(
        (card) =>
            card.querySelector(".stock-header")?.textContent.trim() === "OIL"
    );

    const oilProfitEl = oilCard?.querySelector(".stat .value");
    if (oilProfitEl) {
        oilProfitEl.textContent = formatCurrency(oilProfit);
    }

    // Stocks (shares only for now)
    Object.entries(state.stocks).forEach(([name, stock]) => {
        const el = document.querySelector(
            `.shares-inline[data-stock-name="${name}"]`
        );
        if (el) {
            el.textContent = `shares: ${stock.shares}`;
        }
    });

    // update leaderboard
    document.getElementById("player-value").textContent = formatCurrency(
        state.netWorth
    );
    document.getElementById("computer-value").textContent = formatCurrency(
        computer.getNetWorth()
    );

    // update portfolio chart
    updatePortfolioChart(state);

    // render bonds
    renderBonds(state.bonds);
    const bondProfit = game.totalBondProfit;
    const bondProfitEl = document.querySelector(".bonds-balance .amount");
    if (bondProfitEl) {
        bondProfitEl.textContent = formatCurrency(bondProfit);
    }

    // update prices
    Object.entries(state.stocks).forEach(([name, stock]) => {
        document.querySelectorAll(".stock-card").forEach((card) => {
            const header = card.querySelector(".stock-header");
            if (!header || header.textContent.trim() !== name) return;

            const priceEl = card.querySelector(".stock-price .price");
            const changeEl = card.querySelector(".stock-price .change");

            const prevPrice = game.previousPrices?.[name];
            const currPrice = stock.price;

            if (priceEl && changeEl && prevPrice && currPrice) {
                const diff = currPrice - prevPrice;
                const percent = ((diff / prevPrice) * 100).toFixed(2);
                const isUp = diff >= 0;

                priceEl.textContent = `$${currPrice.toFixed(2)}`;
                changeEl.textContent = `${isUp ? "▲" : "▼"} ${Math.abs(
                    percent
                )}%`;

                const container = card.querySelector(".stock-price");
                container.classList.toggle("positive", isUp);
                container.classList.toggle("negative", !isUp);
            }
        });
    });

    Object.entries(state.stocks).forEach(([name, stock]) => {
        const card = [...document.querySelectorAll(".stock-card")].find(
            (c) => c.querySelector(".stock-header")?.textContent.trim() === name
        );

        if (card) {
            renderStockMiniChart(card, name);
        }
    });

    Object.entries(state.stocks).forEach(([name, stock]) => {
        const card = [...document.querySelectorAll(".stock-card")].find(
            (c) => c.querySelector(".stock-header")?.textContent.trim() === name
        );

        if (card) {
            const profitEl = card.querySelector(".stock-profit-value");
            if (profitEl) {
                const profit = game.getLifetimeStockProfit(name);
                profitEl.textContent = formatCurrency(profit);
                profitEl.classList.toggle("text-green", profit >= 0);
                profitEl.classList.toggle("text-red", profit < 0);
            }
        }
    });
}

window.updateUI = updateUI;

const game = createGameWithAutoUI(GameAPI, updateUI);
const computer = new ComputerPlayer();
window.computer = computer;
window.game = game;

window.setTrigger = setTrigger;
window.startTime = startTime;

window.showNotification = showNotification;
window.updateYearProgress = updateYearProgress;
window.eventManager = eventManager;

function startGame() {
    const startScreen = document.getElementById("start-screen");
    document.getElementById("end-screen").classList.add("hidden");
    startScreen.classList.remove("hidden");
    startScreen.classList.add("fade-out");

    tradeCount = 0;

    // Wait for animation to finish before hiding completely or starting game logic
    setTimeout(() => {
        startScreen.style.display = "none";
        // Insert your actual game-starting logic here if needed
    }, 600); // duration matches CSS animation
    startTime();
}

function showEndScreen() {
    const end = document.getElementById("end-screen");
    end.classList.remove("hidden");

    const statsDiv = document.getElementById("end-stats");

    const playerNet = game.getNetWorth();
    const computerNet = computer.getNetWorth();
    const cashOnlyEarned = 20 * 10000 + eventManager.eventCashFlow;

    statsDiv.innerHTML = `
    <p>Your Final Net Worth: $${playerNet.toLocaleString()}</p>
    <p>Computer's Final Net Worth: $${computerNet.toLocaleString()}</p>
    <p>“Cash‑only” Money Earned: $${cashOnlyEarned.toLocaleString()}</p>
    <p>Trades Made: ${tradeCount}</p>
  `;
}

// helper to show any of these popups + pause the clock
function showDialog(popupId, actionBtnSelector, onClose) {
    setTrigger(true);
    document.getElementById("overlay").classList.add("active");
    const popup = document.getElementById(popupId);
    popup.classList.add("active");

    popup.querySelector(actionBtnSelector).onclick = () => {
        popup.classList.remove("active");
        document.getElementById("overlay").classList.remove("active");
        setTrigger(false);
        if (onClose) onClose();
    };
}

window.startGame = startGame;
window.showEndScreen = showEndScreen;

// =======================
// DOM Content Init
// =======================

document.addEventListener("DOMContentLoaded", async () => {
    await loadAllHistoricalData();
    game.updatePrices();

    // Expose to console
    window.historicalData = historicalData;

    // Portfolio pie chart
    const ctx = document.getElementById("portfolioChart").getContext("2d");
    initPortfolioChart();
    updateUI();

    // Show Help
    document.getElementById("help-btn").onclick = () => {
        showDialog("help-popup", "#help-actions button");
    };

    // Show Pause
    document.getElementById("pause-btn").onclick = () => {
        showDialog("pause-popup", "#pause-actions button");
    };

    // savings card
    const savingsCard = document.querySelector(".savings-card");
    const actionsContainer = savingsCard.querySelector(".card-actions");

    const depositBtn = savingsCard.querySelector("button:nth-child(2)");
    const withdrawBtn = savingsCard.querySelector("button:nth-child(1)");

    createInputFlow({
        type: "deposit",
        button: depositBtn,
        siblingButton: withdrawBtn,
        container: actionsContainer,
        defaultValue: () => game.getGameState().cash.toFixed(2), // optional
        onSubmit: (val) => {
            try {
                game.depositToSavings(parseFloat(val));
            } catch (err) {
                showNotification(err.message, "error");
            }
        },
    });

    createInputFlow({
        type: "withdraw",
        button: withdrawBtn,
        siblingButton: depositBtn,
        container: actionsContainer,
        defaultValue: () => game.getGameState().savings.toFixed(2),
        onSubmit: (val) => {
            try {
                game.withdrawFromSavings(parseFloat(val));
            } catch (err) {
                showNotification(err.message, "error");
            }
        },
    });

    // === INDEX FUND SETUP ===
    const indexCard = document.querySelector(".index-fund-card");
    const indexActions = indexCard.querySelector(".card-actions");

    const indexSellBtn = indexActions.querySelector("button:nth-child(1)");
    const indexBuyBtn = indexActions.querySelector("button:nth-child(2)");

    createInputFlow({
        type: "sell",
        button: indexSellBtn,
        siblingButton: indexBuyBtn,
        container: indexActions,
        defaultValue: () =>
            (
                game.getGameState().indexFund.price *
                game.getGameState().indexFund.shares
            ).toFixed(2),
        onSubmit: (val) => {
            try {
                game.sellIndexFund(parseFloat(val));
            } catch (err) {
                showNotification(err.message, "error");
            }
        },
    });

    createInputFlow({
        type: "buy",
        button: indexBuyBtn,
        siblingButton: indexSellBtn,
        container: indexActions,
        defaultValue: () => game.getGameState().cash.toFixed(2), // or available cash
        onSubmit: (val) => {
            try {
                game.buyIndexFund(parseFloat(val));
            } catch (err) {
                showNotification(err.message, "error");
            }
        },
    });

    // gold card
    const goldCard = document.querySelectorAll(".wide-card")[1];
    const goldActions = goldCard.querySelector(".stock-actions");
    const goldSellBtn = goldActions.querySelector("button:nth-child(1)");
    const goldBuyBtn = goldActions.querySelector("button:nth-child(2)");

    createInputFlow({
        type: "sell",
        button: goldSellBtn,
        siblingButton: goldBuyBtn,
        container: goldActions,
        defaultValue: () => game.getGameState().gold.balance.toFixed(2), // example: current gold balance
        onSubmit: (val) => {
            try {
                game.sellGold(parseFloat(val));
            } catch (err) {
                showNotification(err.message, "error");
            }
        },
    });

    createInputFlow({
        type: "buy",
        button: goldBuyBtn,
        siblingButton: goldSellBtn,
        container: goldActions,
        defaultValue: () => game.getGameState().cash.toFixed(2), // example: available cash
        onSubmit: (val) => {
            try {
                game.buyGold(parseFloat(val));
            } catch (err) {
                showNotification(err.message, "error");
            }
        },
    });

    // === OIL CARD ===
    const oilCard = document.querySelectorAll(".wide-card")[0]; // first wide card
    const oilQuantities = oilCard.querySelectorAll(".stock-quantities button");
    const oilBuyBtn = oilCard.querySelector(
        ".stock-actions button:nth-child(2)"
    );
    const oilSellBtn = oilCard.querySelector(
        ".stock-actions button:nth-child(1)"
    );
    let selectedOilAmount = 1; // default

    // === Handle quantity selection ===
    oilQuantities.forEach((btn) => {
        btn.addEventListener("click", () => {
            oilQuantities.forEach((b) => b.classList.remove("selected"));
            btn.classList.add("selected");
            selectedOilAmount =
                btn.textContent === "MAX" ? "MAX" : parseInt(btn.textContent);
        });

        if (btn.textContent === "1") btn.classList.add("selected"); // default select
    });

    // === Initially bold the "1" button ===
    oilQuantities.forEach((btn) => {
        if (btn.textContent === "1") btn.classList.add("selected");
    });

    const getOilPrice = () => game.getGameState().oil.price;

    // === Buy and Sell Handlers ===
    oilBuyBtn.addEventListener("click", () => {
        try {
            const price = getOilPrice();
            const qty =
                selectedOilAmount === "MAX"
                    ? Math.floor(game.getGameState().cash / price)
                    : selectedOilAmount;

            game.buyOil(qty);
        } catch (err) {
            showNotification(err.message, "error");
        }
    });

    oilSellBtn.addEventListener("click", () => {
        try {
            const maxQty = Math.floor(game.getGameState().oil.barrels);
            const qty =
                selectedOilAmount === "MAX" ? maxQty : selectedOilAmount;

            game.sellOil(qty);
        } catch (err) {
            showNotification(err.message, "error");
        }
    });

    // === APPLY LOGIC TO EACH STOCK CARD ===
    document.querySelectorAll(".stock-card").forEach(setupStockCard);

    // BONDS
    const bondsCard = document.querySelector(".bonds-card");
    const bondActions = bondsCard.querySelector(".card-actions");
    const bondBuyBtn = bondActions.querySelector(".shadow-button");
    const bondCharts = bondsCard.querySelector(".bond-charts");

    let bondInput = null;
    let bondCancelBtn = null;
    let bondInputWrapper = null;
    let bondOptions = null;
    let bondAPYText = null;
    let bondActive = false;
    let selectedBondYears = 1;

    const apyMap = {
        1: 2.5,
        3: 4.5,
        5: 6.5,
    };

    function createBondBuyOptions() {
        if (bondOptions) return; // Prevent duplicates

        bondOptions = document.createElement("div");
        bondOptions.className = "bond-options";

        [1, 3, 5].forEach((years) => {
            const btn = document.createElement("div");
            btn.className = "bond-circle";
            btn.textContent = `${years}yr`;
            if (years === 1) btn.classList.add("selected");

            btn.addEventListener("click", () => {
                selectedBondYears = years;
                updateBondAPY();
                document
                    .querySelectorAll(".bond-circle")
                    .forEach((c) => c.classList.remove("selected"));
                btn.classList.add("selected");
            });

            bondOptions.appendChild(btn);
        });

        bondsCard.insertBefore(bondOptions, bondActions);
    }

    function updateBondAPY() {
        if (!bondAPYText) {
            bondAPYText = document.createElement("div");
            bondAPYText.className = "bond-apy";
            bondsCard.insertBefore(bondAPYText, bondActions);
        }
        bondAPYText.textContent = `APY: ${apyMap[selectedBondYears]}%`;
    }

    function resetBondFlow() {
        bondInput?.remove();
        bondCancelBtn?.remove();
        bondInputWrapper?.remove();
        bondOptions?.remove();
        bondOptions = null; // allow future re-creation
        bondAPYText?.remove();
        bondAPYText = null;
        bondBuyBtn.style.transform = "none";
        bondCharts.style.display = "flex";
        bondActive = false;
        bondActions.appendChild(bondBuyBtn);
        bondActions.style.display = "flex"; // restore default actions
    }

    bondBuyBtn.addEventListener("click", () => {
        if (!bondActive) {
            bondCharts.style.display = "none";
            selectedBondYears = 1;
            createBondBuyOptions();
            updateBondAPY();

            bondInputWrapper = document.createElement("div");
            bondInputWrapper.className = "bond-input-row"; // flex container

            bondCancelBtn = document.createElement("button");
            bondCancelBtn.textContent = "✖";
            bondCancelBtn.className = "shadow-button small";
            bondCancelBtn.style.minWidth = "36px";
            bondCancelBtn.style.height = "36px";
            bondCancelBtn.addEventListener("click", resetBondFlow);

            bondInput = document.createElement("input");
            bondInput.type = "number";
            bondInput.className = "savings-input";
            bondInput.placeholder = "$";

            // Move the BUY button into the row too
            bondBuyBtn.style.transform = "none";
            bondBuyBtn.style.marginTop = "0"; // optional, clean layout

            const inputWrapper = document.createElement("div");
            inputWrapper.className = "input-wrapper";

            const maxBtn = document.createElement("span");
            maxBtn.textContent = "MAX";
            maxBtn.className = "max-label";
            maxBtn.addEventListener("click", () => {
                bondInput.value = game.getGameState().cash.toFixed(2);
            });
            inputWrapper.appendChild(maxBtn);
            inputWrapper.appendChild(bondInput);

            bondInputWrapper.appendChild(bondCancelBtn);
            bondInputWrapper.appendChild(inputWrapper); // not bondInput directly
            bondInputWrapper.appendChild(bondBuyBtn);

            bondsCard.insertBefore(bondInputWrapper, bondActions); // insert above old button location
            bondActions.style.display = "none"; // hide original container

            // Insert the whole input row
            bondsCard.insertBefore(bondInputWrapper, bondActions);

            bondInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    confirmBondPurchase();
                } else if (e.key === "Escape") {
                    resetBondFlow();
                }
            });

            bondActive = true;
            setTimeout(() => bondInput.focus(), 0);
        } else {
            confirmBondPurchase();
        }
    });

    function confirmBondPurchase() {
        const value = parseFloat(bondInput.value || "0");
        if (isNaN(value) || value <= 0) return;

        try {
            game.buyBond(value, selectedBondYears); // ✅ real logic
            resetBondFlow();
            // addBond(value); // uses your existing chart logic
            updateUI();
        } catch (err) {
            showNotification(err.message, "error");
        }
    }

    // update visuals
    updateUI();
    game.advanceQuarter();
    updateUI();
});
