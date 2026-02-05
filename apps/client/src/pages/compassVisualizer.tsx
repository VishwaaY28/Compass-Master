import React from 'react';
import { Toaster } from 'react-hot-toast';

const EXTERNAL_URL = 'http://localhost:3000/';

const CompassVisualizer: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />

      {/*<header className="border-b sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="container px-6 py-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-semibold">Visualizer</h1>
              <p className="text-xs text-muted-foreground">
              Capability Insights Through Node-Based Visualization.
              </p>
            </div>
          </div>
        </div>
      </header> */}

      <div className="mx-auto h-[calc(100vh)]">
        <div className="w-full h-full rounded overflow-hidden border border-gray-200">
          {/*
            Use an iframe to render the external visualizer. We set width/height to fill
            the available area and remove borders. The `sandbox` attribute is intentionally
            omitted so the page can function normally; if you need restrictions, add
            sandbox attributes later.
          */}
          <iframe
            title="Compass Visualizer"
            src={EXTERNAL_URL}
            className="w-full h-full"
            style={{ border: '0' }}
            // allowFullScreen enables fullscreen if the remote app requests it
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
};

export default CompassVisualizer;
