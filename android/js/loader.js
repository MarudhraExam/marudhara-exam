(function () {
    'use strict';

    // Detect Android App
    const isAndroidApp =
        navigator.userAgent.includes("MarudharaExamAndroidApp");

    if (!isAndroidApp) {
        return;
    }

    console.log("Marudhara Exam Android Mode Enabled");

    // Android class
    document.documentElement.classList.add("android-app");
    document.body.classList.add("android-app");

})();
