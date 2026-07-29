export var RuntimeState;
(function (RuntimeState) {
    RuntimeState["BOOTING"] = "BOOTING";
    RuntimeState["INITIALIZING"] = "INITIALIZING";
    RuntimeState["READY"] = "READY";
    RuntimeState["RUNNING"] = "RUNNING";
    RuntimeState["STOPPING"] = "STOPPING";
    RuntimeState["STOPPED"] = "STOPPED";
    RuntimeState["FAILED"] = "FAILED";
})(RuntimeState || (RuntimeState = {}));
