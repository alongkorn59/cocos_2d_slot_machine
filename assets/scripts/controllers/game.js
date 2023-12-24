var Reel = require('reel');
var AudioManager = require('audio-manager');
var UserDefault = require('user-default');
var PayTableTags = require('paytable-tags')();

cc.Class({
    extends: cc.Component,
    properties: {
        initialReelPositions: [],
        reels: {
            default: [],
            type: [Reel]
        },
        currentCredit: {
            default: 100,
            type: cc.Integer
        },
        betOneValue: {
            default: 1,
            type: cc.Integer
        },
        betMaxValue: {
            default: 5,
            type: cc.Integer
        },
        spinButton: {
            default: null,
            type: cc.Button
        },
        autoSpinButton: {
            default: null,
            type: cc.Button
        },
        betOneButton: {
            default: null,
            type: cc.Button
        },
        betMaxButton: {
            default: null,
            type: cc.Button
        },
        totalBetLabel: {
            default: null,
            type: cc.Label
        },
        creditLabel: {
            default: null,
            type: cc.Label
        },
        betInfoLabel: {
            default: null,
            type: cc.Label
        },
        rollingCompletedCount: {
            default: 0,
            visible: false,
            type: cc.Integer
        },
        isRollingCompleted: {
            default: true,
            visible: false
        },
        totalBetValue: {
            default: 0,
            visible: false,
            type: cc.Integer
        },
        currentBetValue: {
            default: 0,
            visible: false,
            type: cc.Integer
        },
        currentPayTableTag: {
            default: 0,
            visible: false,
            type: cc.Integer
        },
        isAutoSpin: {
            default: false,
            visible: false
        },
        autoSpinTimer: {
            default: null,
            visible: false
        }
    },

    onLoad: function () {
        var that = this;
        this.creditLabel.string = this.currentCredit.toString();
        this.betInfoLabel.string = "";

        this.storeInitialReelPositions();

        this.spinButton.node.on(cc.Node.EventType.TOUCH_END, function (event) {
            that.spin();
        });

        this.autoSpinButton.node.on(cc.Node.EventType.TOUCH_END, function (event) {
            // Use custom functions for on/off behavior
            if (that.isAutoSpin) {
                that.offButtonClick();
            } else {
                that.onButtonClick();
            }
        });

        this.betOneButton.node.on(cc.Node.EventType.TOUCH_END, function (event) {
            that.betMaxButton.getComponent(cc.Button).interactable = true;
            that.currentBetValue = that.betOneValue;
            that.currentPayTableTag = PayTableTags.BET_ONE;
            that.betInfoLabel.string = that.currentBetValue.toString();
            AudioManager.instance.playCoinsInsert();
        });

        this.betMaxButton.node.on(cc.Node.EventType.TOUCH_END, function (event) {
            that.betOneButton.getComponent(cc.Button).interactable = true;
            that.currentBetValue = that.betMaxValue;
            that.currentPayTableTag = PayTableTags.BET_MAX;
            that.betInfoLabel.string = that.currentBetValue.toString();
            AudioManager.instance.playCoinsInsert();
        });

        this.node.on('rolling-completed', function (event) {
            that.rollingCompletedCount++;
            AudioManager.instance.playReelStop();

            if (that.rollingCompletedCount == that.reels.length) {
                that.rollingCompletedCount = 0;
                var lineSymbolsTags = that.getLineSymbolsTag();
                var paytable = that.getComponent("paytable"),
                    paytableRet = paytable.isWinning(lineSymbolsTags, that.currentPayTableTag),
                    isWinning = Object.keys(paytableRet).length > 0;

                if (isWinning) {
                    that.isRollingCompleted = true;
                    that.isAutoSpin ? that.autoSpinButton.getComponent(cc.Button).interactable = true : that.spinButton.getComponent(cc.Button).interactable = true;
                    that.isAutoSpin = false;
                    AudioManager.instance.playLineWin();
                    AudioManager.instance.playCoinsWin();
                    that.showWinningSymbolsAndPay(paytableRet);
                } else {
                    that.updateCurrenCredit(that.currentCredit - that.currentBetValue);
                    that.betInfoLabel.string = (-that.currentBetValue).toString();

                    if (!that.isAutoSpin) {
                        that.isRollingCompleted = true;
                        that.spinButton.getComponent(cc.Button).interactable = true;
                    } else {
                        that.autoSpinTimer = setTimeout(function () {
                            that.spin();
                        }, 1000);
                    }
                }
                if (that.isRollingCompleted) {
                    that.setButtonsLocked(false);
                    UserDefault.instance.setCurrentCredit(that.currentCredit);
                }
            }
        });
    },
    storeInitialReelPositions: function () {
        // Store the initial positions of the reels
        this.initialReelPositions = [];
        for (var i = 0; i < this.reels.length; i++) {
            this.initialReelPositions.push(this.reels[i].getPosition().clone());
        }
    },

    start: function () {
        this.loadUserDefault();
    },

    loadUserDefault: function () {
        this.updateCurrenCredit(UserDefault.instance.getCurrentCredit(this.currentCredit));
    },

    spin: function () {
        if (this.currentCredit === 0) {
            return;
        }
        this.betInfoLabel.string = this.currentBetValue.toString();

        if (this.isRollingCompleted) {
            this.totalBetValue += this.currentBetValue;
            this.totalBetLabel.string = this.totalBetValue.toString();

            if (!this.isAutoSpin) {
                this.isRollingCompleted = false;
            }

            // Reset the reels before spinning
            this.resetReels();

            this.setButtonsLocked(true);
            AudioManager.instance.playReelRoll();

            for (var i = 0; i < this.reels.length; i++) {
                this.reels[i].spin();
            }
        }
    },
    resetReels: function () {
        for (var i = 0; i < this.reels.length; i++) {
            // Assuming Reel class has a reset method
            this.reels[i].reset(this.initialReelPositions[i]);
        }
    },

    setButtonsLocked: function (isLocked) {
        if (!this.isAutoSpin) {
            this.autoSpinButton.getComponent(cc.Button).interactable = !isLocked;
        }

        this.spinButton.getComponent(cc.Button).interactable = !isLocked;
        this.betOneButton.getComponent(cc.Button).interactable = !isLocked;
        this.betMaxButton.getComponent(cc.Button).interactable = !isLocked;
    },

    getLineSymbolsTag: function () {
        var lineSymbolsTags = [];
        for (var m = 0; m < this.reels.length; m++) {
            var stopNode = this.reels[m].getWinnerStop();
            var stopComponent = stopNode.getComponent("stop");
            lineSymbolsTags.push(stopComponent.tag);
        }
        return lineSymbolsTags;
    },

    showWinningSymbolsAndPay: function (paytableRet) {
        var stopNode,
            stopComponent,
            winningAmount = 0;

        for (var i = 0; i < paytableRet.length; i++) {
            var item = paytableRet[i];
            for (var n = 0; n < item.indexes.length; n++) {
                stopNode = this.reels[item.indexes[n]].getWinnerStop();
                stopComponent = stopNode.getComponent("stop");
                stopComponent.blink();
            }
            winningAmount += parseInt(item.winningValue);
        }

        this.updateCurrenCredit(this.currentCredit + winningAmount);
        this.betInfoLabel.string = winningAmount.toString();
    },

    updateCurrenCredit: function (value) {
        this.currentCredit = value;
        this.creditLabel.string = this.currentCredit.toString();
        if (parseInt(this.currentCredit) <= 0) {
            AudioManager.instance.playGameOver();
            this.updateCurrenCredit(100);
        }
    },

    onButtonClick: function () {
        this.isAutoSpin = true;
        this.spin();
    },

    offButtonClick: function () {
        this.isAutoSpin = false;
        clearTimeout(this.autoSpinTimer);
    }
});
