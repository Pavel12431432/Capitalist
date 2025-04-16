// data_manager.js

export const historicalData = {
    stocks: {
        "FIZZY DRINKS CO.": [],
        "BIG BANK": [],
        "HEALTHCORE LABS": [],
        "NEWWAVE TECH": [],
    },
    commodities: {
        gold: [],
        oil: [],
    },
    indexFund: [],
};

export function getHistoricalPrice(assetType, nameOrKey, quarterIndex) {
    if (assetType === "indexFund") {
        return historicalData[assetType][quarterIndex] ?? null;
    }
    return historicalData[assetType][nameOrKey]?.[quarterIndex] ?? null;
}

export async function loadCSVData(url) {
    const response = await fetch(url);
    const text = await response.text();

    // Quote-aware CSV parser
    function parseCSV(text) {
        const lines = text.trim().split("\n");
        return lines.map((line) => {
            const cells = [];
            let cell = "";
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === "," && !inQuotes) {
                    cells.push(cell.trim());
                    cell = "";
                } else {
                    cell += char;
                }
            }
            cells.push(cell.trim());
            return cells;
        });
    }

    const clean = (str) => str.trim().replace(/^"|"$/g, "").replace(/,/g, "");

    const rows = parseCSV(text);
    const header = rows[0].map(clean);
    const dateIndex = header.indexOf("Date");
    const priceIndex = header.indexOf("Price");

    if (dateIndex === -1 || priceIndex === -1) {
        throw new Error("CSV is missing required columns");
    }

    const parsed = rows
        .slice(1)
        .map((r) => {
            const raw = clean(r[priceIndex]);
            const price = parseFloat(raw);
            return {
                date: clean(r[dateIndex]),
                price: isNaN(price) ? null : price,
            };
        })
        .filter((p) => p.price != null)
        .reverse();

    // Take every 3rd row (quarterly data)
    return parsed
        .filter((_, i) => i % 3 === 0)
        .slice(0, 80)
        .map((p) => p.price);
}

// Example bulk loader
export async function loadAllHistoricalData() {
    historicalData.stocks["FIZZY DRINKS CO."] = await loadCSVData(
        "data/Coca-Cola Stock Price History.csv"
    );
    historicalData.stocks["BIG BANK"] = await loadCSVData(
        "data/Citigroup Stock Price History.csv"
    );
    historicalData.stocks["HEALTHCORE LABS"] = await loadCSVData(
        "data/J&J Stock Price History.csv"
    );
    historicalData.stocks["NEWWAVE TECH"] = await loadCSVData(
        "data/Microsoft Stock Price History.csv"
    );

    historicalData.commodities.gold = await loadCSVData(
        "data/Gold Futures Historical Data.csv"
    );
    historicalData.commodities.oil = await loadCSVData(
        "data/Crude Oil WTI Futures Historical Data.csv"
    );

    historicalData.indexFund = await loadCSVData(
        "data/S&P 500 Historical Data (1).csv"
    );
}
