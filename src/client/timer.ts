import { PieceColor } from "../shared/types.js";
import { formatMinSec } from "../shared/utils.js";
import { flip } from "./drawBoard.js";
import { localGameState } from "./gameLogic.js";


const initialTimeBottomText = document.getElementById('initialTimeBottom')! as HTMLSpanElement;
const incrementBottomText = document.getElementById('incrementBottom')! as HTMLSpanElement;
const timeLeftBottomText = document.getElementById('timeLeftBottom')! as HTMLSpanElement;
const initialTimeTopText = document.getElementById('initialTimeTop')! as HTMLSpanElement;
const incrementTopText = document.getElementById('incrementTop')! as HTMLSpanElement;
const timeLeftTopText = document.getElementById('timeLeftTop')! as HTMLSpanElement;
const clockPeriod = 100; // in ms
setInterval(countClock, clockPeriod);

function countClock(): void {
    if (localGameState?.clockRunning) {
        if (localGameState.currentTurn === PieceColor.WHITE) {
            localGameState.timeLeftWhite -= clockPeriod / 1000;
        } else if (localGameState.currentTurn === PieceColor.BLACK) {
            localGameState.timeLeftBlack -= clockPeriod / 1000;
        }

        if (flip) {
            timeLeftTopText.textContent = formatMinSec(localGameState.timeLeftWhite, 1);
            timeLeftBottomText.textContent = formatMinSec(localGameState.timeLeftBlack, 1);
        } else {
            timeLeftTopText.textContent = formatMinSec(localGameState.timeLeftBlack, 1);
            timeLeftBottomText.textContent = formatMinSec(localGameState.timeLeftWhite, 1);
        }
    }
}

export function updateTimeDisplay(): void{
    if (!localGameState) {
        return;
    }
    
    if (flip) {
        initialTimeTopText.textContent = formatMinSec(localGameState.initialTimeWhite, 0);
        initialTimeBottomText.textContent = formatMinSec(localGameState.initialTimeBlack, 0);
        incrementTopText.textContent = localGameState.incrementWhite.toString();
        incrementBottomText.textContent = localGameState.incrementBlack.toString();
        timeLeftTopText.textContent = formatMinSec(localGameState.timeLeftWhite, 1);
        timeLeftBottomText.textContent = formatMinSec(localGameState.timeLeftBlack, 1);
    } else {
        initialTimeTopText.textContent = formatMinSec(localGameState.initialTimeBlack, 0);
        initialTimeBottomText.textContent = formatMinSec(localGameState.initialTimeWhite, 0);
        incrementTopText.textContent = localGameState.incrementBlack.toString();
        incrementBottomText.textContent = localGameState.incrementWhite.toString();
        timeLeftTopText.textContent = formatMinSec(localGameState.timeLeftBlack, 1);
        timeLeftBottomText.textContent = formatMinSec(localGameState.timeLeftWhite, 1);
    }
}

export function syncTime( clockRunning: boolean, timeLeftWhite: number, timeLeftBlack: number, initialTimeWhite: number, initialTimeBlack: number, incrementWhite: number, incrementBlack: number): void {
    if (!localGameState) {
        return;
    }
    localGameState.clockRunning = clockRunning;
    localGameState.initialTimeWhite = initialTimeWhite;
    localGameState.initialTimeBlack = initialTimeBlack;
    localGameState.incrementWhite = incrementWhite;
    localGameState.incrementBlack = incrementBlack;
    localGameState.timeLeftWhite = timeLeftWhite;
    localGameState.timeLeftBlack = timeLeftBlack;
    updateTimeDisplay();
}