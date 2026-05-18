package com.executiveflow.app;

import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(HealthConnectPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart() {
        super.onStart();
        // Disable WebView native long-press popup (shows app logo overlay)
        WebView webView = getBridge().getWebView();
        webView.setOnLongClickListener(v -> true);
        webView.setHapticFeedbackEnabled(false);
    }
}
