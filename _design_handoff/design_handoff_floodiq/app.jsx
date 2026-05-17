// App entry — full flow as 4 artboards.

const ARTBOARD_W = 412;

function App() {
  return (
    <DesignCanvas>
      <DCSection
        id="flow"
        title="FloodIQ · core flow"
        subtitle="Landing → Loading → Result → Error. Mobile-first @ 412px."
      >
        <DCArtboard id="landing" label="1 · Landing" width={ARTBOARD_W} height={1200}>
          <Landing />
        </DCArtboard>
        <DCArtboard id="loading" label="2 · Loading · live" width={ARTBOARD_W} height={1200}>
          <Loading />
        </DCArtboard>
        <DCArtboard id="result" label="3 · Result · rooftop match" width={ARTBOARD_W} height={2000}>
          <Direction3 pageBg="#ffffff" />
        </DCArtboard>
        <DCArtboard id="result-approx" label="3b · Result · approximate match" width={ARTBOARD_W} height={2000}>
          <Direction3 pageBg="#ffffff" approximate />
        </DCArtboard>
        <DCArtboard id="error" label="4 · Error" width={ARTBOARD_W} height={1100}>
          <ErrorScreen />
        </DCArtboard>
      </DCSection>

      <DCPostIt x={40} y={40} w={340}>
        Full core flow + confirmation map.
        {'\n\n'}
        The map sits directly beneath the matched-address line — single pin, beige duotone tiles, ~5 km scale. Two variants of the result page: rooftop-match (default) and approximate-match (shows the warning badge over the pin).
        {'\n\n'}
        Map is built on OpenStreetMap tiles for the comp. In production, swap the tile URL for Mapbox Static Images — the tile math is identical.
        {'\n\n'}
        Loading screen still ticks live: elapsed timer + pipeline + 8-second message transition.
      </DCPostIt>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
