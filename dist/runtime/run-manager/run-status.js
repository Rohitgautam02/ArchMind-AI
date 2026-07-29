export var RunStatus;
(function (RunStatus) {
    RunStatus["CREATED"] = "CREATED";
    RunStatus["RUNNING"] = "RUNNING";
    RunStatus["PAUSED"] = "PAUSED";
    RunStatus["COMPLETED"] = "COMPLETED";
    RunStatus["CANCELLED"] = "CANCELLED";
    RunStatus["FAILED"] = "FAILED";
})(RunStatus || (RunStatus = {}));
export const terminalRunStatuses = [
    RunStatus.COMPLETED,
    RunStatus.CANCELLED,
    RunStatus.FAILED,
];
