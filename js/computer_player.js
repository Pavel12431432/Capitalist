export class ComputerPlayer {
    constructor() {
        this.cash = 0;

        this.gold = {
            ounces: 0,
            price: 100, // update externally
            totalCost: 0,
        };

        this.indexFund = {
            shares: 0,
            price: 100, // update externally
        };
    }

    setCash(newCash) {
        const delta = newCash - this.cash;

        // Case 1: If we already had cash (e.g. game start), invest it fully
        if (this.cash > 0.01) {
            const goldAmount = this.cash * 0.2;
            const indexAmount = this.cash * 0.8;

            this.buyGold(goldAmount);
            this.buyIndexFund(indexAmount);
        }

        // Case 2: Gained cash
        if (delta > 0.01) {
            // Step 1: bring ratio to 4:1 (index:gold)
            const indexValue = this.getIndexFundValue();
            const goldValue = this.getGoldValue();
            const targetGold = indexValue / 4;
            const goldGap = targetGold - goldValue;

            if (goldGap > 0.01) {
                const amountToBuy = Math.min(goldGap, delta);
                this.buyGold(amountToBuy);
                newCash -= amountToBuy;
            }

            // Step 2: invest remaining in 4:1 split
            const goldAmount = newCash * 0.2;
            const indexAmount = newCash * 0.8;

            this.buyGold(goldAmount);
            this.buyIndexFund(indexAmount);
        }

        // Case 3: Lost cash → sell to recover
        else if (delta < -0.01) {
            const needed = Math.abs(delta);
            let raised = 0;

            const goldValue = this.getGoldValue();
            if (goldValue > 0) {
                const sellGoldAmount = Math.min(needed, goldValue);
                this.sellGold(sellGoldAmount);
                raised += sellGoldAmount;
            }

            if (raised < needed) {
                const remaining = needed - raised;
                const indexValue = this.getIndexFundValue();
                const sellIndexAmount = Math.min(remaining, indexValue);
                this.sellIndexFund(sellIndexAmount);
                raised += sellIndexAmount;
            }
        }
        // Always reset cash to 0
        this.cash = 0;
    }

    updatePrices(goldPrice, indexPrice) {
        this.gold.price = goldPrice;
        this.indexFund.price = indexPrice;
    }

    buyGold(amount) {
        const ounces = amount / this.gold.price;
        this.gold.ounces += ounces;
        this.gold.totalCost += amount;
        this.cash -= amount;
    }

    sellGold(amount) {
        const ounces = amount / this.gold.price;
        this.gold.ounces -= ounces;
        this.cash += amount;
    }

    buyIndexFund(amount) {
        const shares = amount / this.indexFund.price;
        this.indexFund.shares += shares;
        this.cash -= amount;
    }

    sellIndexFund(amount) {
        const shares = amount / this.indexFund.price;
        this.indexFund.shares -= shares;
        this.cash += amount;
    }

    getGoldValue() {
        return this.gold.ounces * this.gold.price;
    }

    getIndexFundValue() {
        return this.indexFund.shares * this.indexFund.price;
    }

    getNetWorth() {
        return this.cash + this.getGoldValue() + this.getIndexFundValue();
    }

    roundMoney(money) {
        return money;
    }
}
