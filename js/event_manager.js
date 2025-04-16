// event_manager.js

const EVENT_PROBABILITY = 0.05;

export const eventManager = {
    activeEvent: null,
    triggered: false,
    showPaymentUI: false,

    eventPool: [
        {
            id: "emergency_surgery",
            name: "Emergency Surgery",
            description: "You needed emergency surgery. It cost $10,000.",
            cost: 10000,
            type: "negative",
            message: "-$10,000.00",
            effect(game) {
                game.setCash(game.cash - this.cost);
            },
        },
        {
            id: "tax_refund",
            name: "Tax Refund",
            description: "You received a surprise refund of $2,000.",
            cash: 2000,
            type: "positive",
            message: "$2,000.00",
            effect(game) {
                game.setCash(game.cash + this.cash);
            },
        },
        {
            id: "car_accident",
            name: "Car Accident Repair",
            description:
                "You were in a minor accident. Car repairs cost $4,000.",
            cost: 4000,
            type: "negative",
            message: "-$4,000.00",
            effect(game) {
                game.setCash(game.cash - this.cost);
            },
        },
        {
            id: "cyber_attack",
            name: "Cyber Attack",
            description: "Hackers drained your savings by 50%.",
            type: "neutral",
            message: "-50% SAVINGS",
            effect(game) {
                game.savings = game.roundMoney(game.savings * 0.5);
            },
        },
        {
            id: "mystery_donor",
            name: "Mysterious Donor",
            description: "An anonymous person sent you $5,000.",
            type: "positive",
            message: "$5,000.00",
            effect(game) {
                game.setCash(game.cash + 5000);
            },
        },
        {
            id: "charity_gift",
            name: "Charity Donation",
            description:
                "You decided to donate $2,000 to a children's hospital.",
            cost: 2000,
            type: "negative",
            message: "-$2,000.00",
            effect(game) {
                game.setCash(game.cash - this.cost);
            },
        },
        {
            id: "windfall",
            name: "Unexpected Inheritance",
            description: "A distant relative passed away and left you $8,000.",
            type: "positive",
            message: "$8,000.00",
            effect(game) {
                game.setCash(game.cash + 8000);
            },
        },
        {
            id: "property_damage",
            name: "Storm Property Damage",
            description: "A storm damaged your home. Repairs cost $6,000.",
            cost: 6000,
            type: "negative",
            message: "-$6,000.00",
            effect(game) {
                game.setCash(game.cash - this.cost);
            },
        },
        {
            id: "savings_bonus",
            name: "Bank Bonus",
            description: "Your bank rewarded you with a $1,500 loyalty bonus.",
            type: "positive",
            message: "$1,500.00",
            effect(game) {
                game.setCash(game.cash + 1500);
            },
        },
        {
            id: "rent_discount",
            name: "Landlord's Kindness",
            description:
                "Your landlord gave you a one-month rent break. You saved $2,500.",
            type: "positive",
            message: "$2,500.00",
            effect(game) {
                game.setCash(game.cash + 2500);
            },
        },
        {
            id: "car_breakdown",
            name: "Car Breakdown",
            description:
                "Your car broke down on the highway. Tow and repairs cost $3,000.",
            cost: 3000,
            type: "negative",
            message: "-$3,000.00",
            effect(game) {
                game.setCash(game.cash - this.cost);
            },
        },
        {
            id: "bonus_from_work",
            name: "Work Bonus",
            description: "You received a bonus of $3,500!",
            type: "positive",
            message: "$3,500.00",
            effect(game) {
                game.setCash(game.cash + 3500);
            },
        },
        {
            id: "pet_emergency",
            name: "Pet Emergency",
            description: "Your pet needed emergency care. Vet bill was $1,800.",
            cost: 1800,
            type: "negative",
            message: "-$1,800.00",
            effect(game) {
                game.setCash(game.cash - this.cost);
            },
        },
        {
            id: "startup_investment",
            name: "Startup Investment",
            description:
                "A friend asks you to invest $5,000 in their startup. Will you take the risk?",
            type: "choice",
            message: "$5,000.00?",
            choices: [
                {
                    label: "Invest",
                    action(game, eventManager) {
                        if (game.cash < 5000) {
                            showNotification(
                                "You don't have enough cash to invest.",
                                "error"
                            );
                            return;
                        }
                        game.setCash(game.cash - 5000);
                        const win = Math.random() < 0.25;
                        const popup = document.getElementById("event-popup");
                        popup.classList.remove("active");

                        if (win) {
                            const successEvent = {
                                id: "startup_success",
                                name: "Startup Success!",
                                description:
                                    "Your friend’s startup went viral! Receive $20,000.",
                                type: "positive",
                                effect(game) {
                                    game.setCash(game.cash + 20000);
                                },
                            };
                            eventManager.activeEvent = successEvent;
                            eventManager.triggered = true;
                            setTrigger(true);
                            eventManager.showEventPopup(successEvent, game);
                        } else {
                            const failEvent = {
                                id: "startup_failure",
                                name: "Startup Failed",
                                description:
                                    "Unfortunately, the startup failed. You lost your investment.",
                                type: "neutral",
                                effect() {},
                            };
                            eventManager.activeEvent = failEvent;
                            eventManager.triggered = true;
                            setTrigger(true);
                            eventManager.showEventPopup(failEvent, game);
                        }
                    },
                },
                {
                    label: "Decline",
                    action(game, eventManager) {
                        eventManager.activeEvent = null;
                        eventManager.triggered = false;
                        setTrigger(false);
                        updateUI();
                        document
                            .getElementById("event-popup")
                            .classList.remove("active");
                    },
                },
            ],
        },
    ],

    tryTriggerRandomEvent(game) {
        const validEvents = this.eventPool.filter((event) => {
            if (event.type === "negative" && event.cost) {
                return 2 * event.cost <= game.getNetWorth();
            }
            return true;
        });

        if (validEvents.length === 0 || Math.random() >= EVENT_PROBABILITY) {
            this.activeEvent = null;
            this.triggered = false;
            setTrigger(false);
            return;
        }

        const event = validEvents[Math.floor(Math.random() * validEvents.length)];
        // const event = this.eventPool[4];
        this.activeEvent = event;
        this.triggered = true;
        setTrigger(true);
        this.showEventPopup(event, game);
    },

    getRandomEvent() {
        const index = Math.floor(Math.random() * this.eventPool.length);
        return this.eventPool[index];
    },

    enableOverlay() {
        document.getElementById("overlay").classList.add("active");

        // Disable all other buttons outside popup
        document
            .querySelectorAll("button:not(#event-popup button)")
            .forEach((btn) => {
                btn.disabled = true;
            });
    },

    disableOverlay() {
        document.getElementById("overlay").classList.remove("active");

        document.querySelectorAll("button").forEach((btn) => {
            btn.disabled = false;
        });
    },

    showEventPopup(event, game) {
        const popup = document.getElementById("event-popup");
        const title = document.getElementById("event-title");
        const desc = document.getElementById("event-description");
        const actions = document.getElementById("event-actions");
        const cost = document.getElementById("event-cost");

        if (cost) {
            cost.textContent = event.message;
        }

        this.enableOverlay();

        title.textContent = event.name;
        desc.textContent = event.description;
        actions.innerHTML = "";

        if (event.type === "positive") {
            const accept = document.createElement("button");
            accept.textContent = "Accept Cash";
            accept.className = "accept";
            accept.classList.add("shadow-button");
            accept.onclick = () => {
                event.effect(game);
                if (event.id != "startup_success")
                    event.effect(computer);
                popup.classList.remove("active");
                this.activeEvent = null;
                this.triggered = false;
                setTrigger(false);
                this.disableOverlay();
                updateUI();
            };
            actions.appendChild(accept);
        } else if (event.type === "negative") {
            const pay = document.createElement("button");
            pay.textContent = "Pay with Pocket Cash";
            pay.className = "pay";
            pay.onclick = () => {
                if (game.cash >= event.cost) {
                    event.effect(game);
                    event.effect(computer);
                    popup.classList.remove("active");
                    this.activeEvent = null;
                    this.triggered = false;
                    setTrigger(false);
                    this.showPaymentUI = false;
                    this.disableOverlay();
                    updateUI();
                } else {
                    showNotification("You don't have enough cash.", "error");
                }
            };
            pay.classList.add("shadow-button");

            const find = document.createElement("button");
            find.textContent = "Find Money";
            find.className = "find-money";
            find.onclick = () => {
                popup.classList.remove("active");
                this.triggered = true;
                setTrigger(true);
                this.showPaymentUI = true;
                this.disableOverlay();
                updateUI();
            };
            find.classList.add("shadow-button");

            actions.appendChild(pay);
            actions.appendChild(find);
        } else if (event.type === "choice") {
            event.choices.forEach((choice) => {
                const btn = document.createElement("button");
                btn.textContent = choice.label;
                btn.className = "accept";
                btn.onclick = () => {
                    choice.action(game, this);
                    this.disableOverlay();
                    updateUI();
                };
                btn.classList.add("shadow-button");
                actions.appendChild(btn);
            });
        } else if (event.type === "neutral") {
            const close = document.createElement("button");
            close.textContent = "Close";
            close.className = "accept";
            close.onclick = () => {
                event.effect(game);
                event.effect(computer);
                popup.classList.remove("active");
                this.activeEvent = null;
                this.triggered = false;
                setTrigger(false);
                this.disableOverlay();
                updateUI();
            };
            close.classList.add("shadow-button");
            actions.appendChild(close);
        }

        popup.classList.add("active");
    },

    hasUnresolvedEvent() {
        return this.triggered && this.activeEvent !== null;
    },
};
