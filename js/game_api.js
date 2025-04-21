// Refactored GameAPI.js – Cleaner, DRYer, More Modular
import { getHistoricalPrice } from "./data_manager.js";
import { eventManager } from "./event_manager.js";
import { showNotification } from "./notification_system.js";

export class GameAPI {
    constructor() {
        this.currentQuarter = 0;
        this.previousPrices = {};

        this.cash = 10000;
        this.savings = 0;

        this.bonds = [];
        this.totalBondProfit = 0;

        this.indexFund = { shares: 0, price: 100 };

        this.gold = { ounces: 0, price: 0, totalCost: 0, lifetimeProfit: 0 };
        this.oil = { barrels: 0, price: 4.0, totalCost: 0, lifetimeProfit: 0 };

        this.stocks = {
            "FIZZY DRINKS CO.": { shares: 0, price: 34.0, totalCost: 0 },
            "BIG BANK": { shares: 0, price: 732.2, totalCost: 0 },
            "HEALTHCORE LABS": { shares: 0, price: 67.1, totalCost: 0 },
            "NEWWAVE TECH": { shares: 0, price: 3.49, totalCost: 0 },
        };

        this.stockLifetimeProfit = Object.fromEntries(
            Object.keys(this.stocks).map((name) => [name, 0])
        );
    }

    // === Utilities ===
    roundMoney(value) {
        return Number(value.toFixed(2));
    }

    setCash(value) {
        this.cash = this.roundMoney(value);
    }

    validateFunds(required) {
        if (this.roundMoney(this.cash) < required)
            throw new Error("Not enough cash.");
    }

    getAvgCost(totalCost, quantity) {
        return quantity > 0 ? totalCost / quantity : 0;
    }

    clampZero(val, epsilon = 1e-4) {
        return Math.abs(val) < epsilon ? 0 : val;
    }

    // === Savings ===
    depositToSavings(amount) {
        this.validateFunds(amount);
        this.setCash(this.cash - amount);
        this.savings = this.roundMoney(this.savings + amount);
    }

    withdrawFromSavings(amount) {
        if (amount > this.savings) throw new Error("Not enough savings.");
        this.setCash(this.cash + amount);
        this.savings = this.roundMoney(this.savings - amount);
    }

    // === Stocks ===
    buyStock(name, quantity) {
        const stock = this.stocks[name];
        if (!stock) throw new Error("Invalid stock.");

        const sharesToBuy =
            quantity === "MAX" ? Math.floor(this.cash / stock.price) : quantity;
        const cost = sharesToBuy * stock.price;
        this.validateFunds(cost);

        stock.shares += sharesToBuy;
        stock.totalCost += cost;
        this.setCash(this.cash - cost);
    }

    sellStock(name, quantity) {
        const stock = this.stocks[name];
        if (!stock) throw new Error("Invalid stock.");

        const sharesToSell = quantity === "MAX" ? stock.shares : quantity;
        if (sharesToSell <= 0 || sharesToSell > stock.shares)
            throw new Error("Insufficient shares.");

        const avgCost = this.getAvgCost(stock.totalCost, stock.shares);
        const revenue = sharesToSell * stock.price;
        const costBasis = sharesToSell * avgCost;
        const profit = revenue - costBasis;

        stock.shares -= sharesToSell;
        stock.totalCost -= costBasis;
        this.setCash(this.cash + revenue);
        this.stockLifetimeProfit[name] += profit;
    }

    getLifetimeStockProfit(name) {
        const stock = this.stocks[name];
        const unrealized = stock.shares * stock.price - stock.totalCost;
        return this.roundMoney(
            this.stockLifetimeProfit[name] + (stock.shares > 0 ? unrealized : 0)
        );
    }

    // === Index Fund ===
    buyIndexFund(amount) {
        this.validateFunds(amount);
        const shares = amount / this.indexFund.price;
        this.indexFund.shares += shares;
        this.setCash(this.cash - amount);
    }

    sellIndexFund(amount) {
        const value = this.roundMoney(
            this.indexFund.shares * this.indexFund.price
        );
        if (amount > value) throw new Error("Not enough index fund value.");

        const shares = amount / this.indexFund.price;
        this.indexFund.shares = this.clampZero(this.indexFund.shares - shares);
        this.setCash(this.cash + amount);
    }

    // === Bonds ===
    buyBond(amount, years) {
        const APY = { 1: 0.025, 3: 0.045, 5: 0.065 };
        const TERMS = { 1: 4, 3: 12, 5: 20 };

        this.validateFunds(amount);
        if (!APY[years]) throw new Error("Invalid bond term.");

        this.setCash(this.cash - amount);
        this.bonds.push({
            principal: amount,
            apy: APY[years],
            term: TERMS[years],
            startQuarter: this.currentQuarter,
            redeemed: false,
        });
    }

    getBondProgress(bond) {
        const elapsed = this.currentQuarter - bond.startQuarter;
        return Math.min(elapsed / bond.term, 1);
    }

    calculateBondValue(bond, quarter = this.currentQuarter) {
        if (bond.redeemed) return 0;
        const elapsed = Math.min(quarter - bond.startQuarter, bond.term);
        const years = Math.floor(elapsed / 4);
        return bond.principal * Math.pow(1 + bond.apy, years);
    }

    getBondValue() {
        return this.bonds.reduce(
            (sum, bond) => sum + this.calculateBondValue(bond),
            0
        );
    }

    redeemBond(index) {
        const bond = this.bonds[index];
        if (!bond || bond.redeemed) throw new Error("Invalid bond.");

        let payout = this.calculateBondValue(bond);

        if (this.getBondProgress(bond) < 1) {
            payout *= 0.9;
            showNotification("Redeemed bond early: recieved 90% of bond value.", "success", 4000);
        } else {
            showNotification("Redeemed bond successfully!", "success");
        }


        this.totalBondProfit += payout - bond.principal;

        this.setCash(this.cash + payout);
        bond.redeemed = true;
    }

    // === Gold ===
    buyGold(amount) {
        const amountInDollars = this.roundMoney(amount);

        this.validateFunds(amountInDollars);
        const units = amountInDollars / this.gold.price;
        this.gold.ounces += units;
        this.gold.totalCost += amountInDollars;
        this.setCash(this.cash - amountInDollars);
    }

    sellGold(amount) {
        const amountInDollars = this.roundMoney(amount);

        const totalValue = this.roundMoney(this.gold.ounces * this.gold.price);
        if (amountInDollars > totalValue) throw new Error(`Not enough gold.`);

        const unitsToSell = amountInDollars / this.gold.price;
        const avgCost = this.getAvgCost(this.gold.totalCost, this.gold.ounces);
        const costBasis = unitsToSell * avgCost;
        const profit = amountInDollars - costBasis;

        this.gold.ounces = this.clampZero(this.gold.ounces - unitsToSell);
        this.gold.totalCost -= costBasis;
        this.gold.lifetimeProfit += profit;
        this.setCash(this.cash + amountInDollars);
    }

    getGoldValue() {
        return this.gold.ounces * this.gold.price;
    }

    getGoldProfit() {
        const value = this.getGoldValue();
        const unrealized =
            this.gold.ounces > 0 ? value - this.gold.totalCost : 0;
        return this.gold.lifetimeProfit + unrealized;
    }

    // === Oil ===
    buyOil(barrels) {
        const cost = barrels * this.oil.price;
        this.validateFunds(cost);
        this.oil.barrels += barrels;
        this.oil.totalCost += cost;
        this.setCash(this.cash - cost);
    }

    sellOil(barrels) {
        if (barrels > this.oil.barrels)
            throw new Error("Not enough oil barrels.");

        const avgCost = this.getAvgCost(this.oil.totalCost, this.oil.barrels);
        const costBasis = barrels * avgCost;
        const revenue = barrels * this.oil.price;
        const profit = revenue - costBasis;

        this.oil.barrels -= barrels;
        this.oil.totalCost -= costBasis;
        this.oil.lifetimeProfit += profit;
        this.setCash(this.cash + revenue);
    }

    getOilProfit() {
        const value = this.oil.barrels * this.oil.price;
        const unrealized =
            this.oil.barrels > 0 ? value - this.oil.totalCost : 0;
        return this.oil.lifetimeProfit + unrealized;
    }

    // === Game Info ===
    getNetWorth() {
        const stockValue = Object.values(this.stocks).reduce(
            (sum, stock) => sum + stock.shares * stock.price,
            0
        );

        return (
            this.cash +
            this.savings +
            this.getBondValue() +
            this.getGoldValue() +
            this.indexFund.shares * this.indexFund.price +
            this.oil.barrels * this.oil.price +
            stockValue
        );
    }

    getGameState() {
        return {
            cash: this.cash,
            savings: this.savings,
            oil: this.oil,
            gold: {
                price: this.gold.price,
                balance: this.getGoldValue(),
            },
            bonds: this.bonds,
            indexFund: this.indexFund,
            stocks: this.stocks,
            netWorth: this.getNetWorth(),
            currentYear: this.getCurrentYear(),
            currentQuarter: this.currentQuarter,
        };
    }

    updatePrices() {
        for (const name in this.stocks) {
            this.previousPrices[name] = this.stocks[name].price;
            const price = getHistoricalPrice(
                "stocks",
                name,
                this.currentQuarter
            );
            if (price != null) this.stocks[name].price = price;
        }

        const updateCommodity = (key) => {
            this.previousPrices[key] = this[key].price;
            const price = getHistoricalPrice(
                "commodities",
                key,
                this.currentQuarter
            );
            if (price != null) this[key].price = price;
        };

        updateCommodity("gold");
        updateCommodity("oil");

        this.previousPrices.indexFund = this.indexFund.price;
        const indexFundPrice = getHistoricalPrice(
            "indexFund",
            null,
            this.currentQuarter
        );
        if (indexFundPrice != null) this.indexFund.price = indexFundPrice;
    }

    advanceQuarter() {
        // 1) Don’t advance if there’s still an open event
        if (eventManager.hasUnresolvedEvent()) {
            showNotification(
                "You must resolve the event before continuing!",
                "error"
            );
            return;
        }

        // 2) End‑of‑game?
        if (this.currentQuarter === 79) {
            showEndScreen();
            setTrigger(true); // lock everything down
            return;
        }

        // 3) Actually bump the quarter
        this.currentQuarter++;

        // 4) Annual bonus every 4 quarters
        if (this.currentQuarter % 4 === 0) {
            this.setCash(this.cash + 10000);
            computer.setCash(computer.cash + 10000);
            this.savings = this.roundMoney(this.savings * 1.01);
            showNotification("Earned $10,000.00!", "success");
        }

        // 5) Refresh prices for both players
        this.updatePrices();
        computer.updatePrices(this.gold.price, this.indexFund.price);

        // 6) Seed computer at quarter 1
        if (this.currentQuarter === 1) {
            computer.setCash(10000);
        }
    }

    getCurrentYear() {
        return Math.floor(this.currentQuarter / 4);
    }
}
