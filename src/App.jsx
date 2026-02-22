import { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from "react";

// ─── Design System ────────────────────────────────────────────────────────────
// Aesthetic: Terminal-noir — dense data, amber-on-black CRT glow, monospace precision
// Typography: "IBM Plex Mono" meets "Neue Haas Grotesk" weight hierarchy
// Color: #0a0a0a base, #f5a623 amber accent, #00e5ff cyan data, #ff4757 danger

// ─── Simulated Data Layer ─────────────────────────────────────────────────────
const COINS = [
  { id: "btc", symbol: "BTC", name: "Bitcoin", color: "#f7931a" },
  { id: "eth", symbol: "ETH", name: "Ethereum", color: "#627eea" },
  { id: "sol", symbol: "SOL", name: "Solana", color: "#9945ff" },
  { id: "ada", symbol: "ADA", name: "Cardano", color: "#0033ad" },
  { id: "bnb", symbol: "BNB", name: "BNB", color: "#f3ba2f" },
  { id: "avax", symbol: "AVAX", name: "Avalanche", color: "#e84142" },
];

const BASE_PRICES = { btc: 67420, eth: 3580, sol: 178, ada: 0.58, bnb: 412, avax: 38.4 };

function generateSparkline(base, points = 20) {
  const data = [];
  let price = base;
  for (let i = 0; i < points; i++) {
    price = price * (1 + (Math.random() - 0.49) * 0.012);
    data.push(price);
  }
  return data;
}

function generateCandles(base, count = 60) {
  const candles = [];
  let price = base;
  const now = Date.now();
  for (let i = count; i >= 0; i--) {
    const open = price;
    const change = (Math.random() - 0.48) * 0.025;
    const close = open * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.008);
    const low = Math.min(open, close) * (1 - Math.random() * 0.008);
    candles.push({ t: now - i * 60000, o: open, h: high, l: low, c: close, v: Math.random() * 1000 + 100 });
    price = close;
  }
  return candles;
}

function generateOrderBook(mid) {
  const asks = [], bids = [];
  for (let i = 0; i < 16; i++) {
    const askPrice = mid * (1 + 0.0003 * (i + 1));
    const bidPrice = mid * (1 - 0.0003 * (i + 1));
    asks.push({ price: askPrice, size: Math.random() * 5 + 0.1, total: 0 });
    bids.push({ price: bidPrice, size: Math.random() * 5 + 0.1, total: 0 });
  }
  let askTotal = 0, bidTotal = 0;
  asks.forEach(a => { askTotal += a.size; a.total = askTotal; });
  bids.forEach(b => { bidTotal += b.size; b.total = bidTotal; });
  const maxTotal = Math.max(askTotal, bidTotal);
  asks.forEach(a => a.pct = (a.total / maxTotal) * 100);
  bids.forEach(b => b.pct = (b.total / maxTotal) * 100);
  return { asks, bids, maxTotal };
}

// ─── Global WS Context (simulated) ───────────────────────────────────────────
const PriceContext = createContext(null);

function PriceProvider({ children }) {
  const [prices, setPrices] = useState(() =>
    Object.fromEntries(COINS.map(c => [c.id, {
      price: BASE_PRICES[c.id],
      change24h: (Math.random() - 0.45) * 12,
      sparkline: generateSparkline(BASE_PRICES[c.id]),
      volume: Math.random() * 8e9 + 1e9,
      status: "streaming",
    }]))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setPrices(prev => {
        const next = { ...prev };
        COINS.forEach(c => {
          const p = prev[c.id].price;
          const newPrice = p * (1 + (Math.random() - 0.495) * 0.003);
          const newSparkline = [...prev[c.id].sparkline.slice(1), newPrice];
          next[c.id] = {
            ...prev[c.id],
            price: newPrice,
            sparkline: newSparkline,
          };
        });
        return next;
      });
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return <PriceContext.Provider value={prices}>{children}</PriceContext.Provider>;
}

// ─── Utility Hooks ─────────────────────────────────────────────────────────────
function usePrices() { return useContext(PriceContext); }

function usePrevious(value) {
  const ref = useRef();
  useEffect(() => { ref.current = value; });
  return ref.current;
}

// ─── Micro Components ──────────────────────────────────────────────────────────
function Sparkline({ data, width = 80, height = 32, color }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");
  const isUp = data[data.length - 1] >= data[0];
  const fill = isUp ? `${color}22` : `#ff475722`;
  const stroke = isUp ? color : "#ff4757";
  const fillPts = `0,${height} ${pts} ${width},${height}`;

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <defs>
        <linearGradient id={`sg-${color?.replace("#","")}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.4" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill={`url(#sg-${color?.replace("#","")})`} />
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function PriceFlash({ price, decimals = 2 }) {
  const prev = usePrevious(price);
  const [flash, setFlash] = useState(null);
  useEffect(() => {
    if (prev === undefined) return;
    const dir = price > prev ? "up" : price < prev ? "down" : null;
    if (dir) {
      setFlash(dir);
      const t = setTimeout(() => setFlash(null), 500);
      return () => clearTimeout(t);
    }
  }, [price, prev]);

  const fmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const color = flash === "up" ? "#00e5ff" : flash === "down" ? "#ff4757" : "#e8e0d0";

  return (
    <span style={{
      color,
      transition: "color 0.3s ease",
      fontFamily: "'IBM Plex Mono', monospace",
      fontVariantNumeric: "tabular-nums",
    }}>
      {fmt.format(price)}
    </span>
  );
}

function Badge({ value }) {
  const pos = value >= 0;
  return (
    <span style={{
      fontSize: "0.7rem",
      padding: "2px 6px",
      borderRadius: "3px",
      background: pos ? "#00e5ff18" : "#ff475718",
      color: pos ? "#00e5ff" : "#ff4757",
      border: `1px solid ${pos ? "#00e5ff44" : "#ff475744"}`,
      fontFamily: "'IBM Plex Mono', monospace",
    }}>
      {pos ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

// ─── Module 1: Ticker Strip ────────────────────────────────────────────────────
function TickerStrip({ onSelectCoin, selectedCoin }) {
  const prices = usePrices();
  const [wsStatus, setWsStatus] = useState("streaming");

  return (
    <div style={{
      background: "#0d0d0d",
      borderBottom: "1px solid #1e1e1e",
      padding: "0 24px",
      display: "flex",
      alignItems: "center",
      gap: "2px",
      height: "52px",
      overflowX: "auto",
      scrollbarWidth: "none",
    }}>
      {/* WS status */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginRight: "20px", flexShrink: 0 }}>
        <div style={{
          width: 7, height: 7, borderRadius: "50%",
          background: wsStatus === "streaming" ? "#00e5ff" : "#ff4757",
          boxShadow: wsStatus === "streaming" ? "0 0 8px #00e5ff" : "0 0 8px #ff4757",
          animation: "pulse 2s infinite",
        }} />
        <span style={{ fontSize: "0.65rem", color: "#555", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.1em" }}>
          LIVE
        </span>
      </div>

      {COINS.map(coin => {
        const p = prices[coin.id];
        if (!p) return null;
        const isSelected = selectedCoin === coin.id;
        return (
          <button key={coin.id} onClick={() => onSelectCoin(coin.id)} style={{
            background: isSelected ? "#1a1a1a" : "transparent",
            border: isSelected ? `1px solid ${coin.color}44` : "1px solid transparent",
            borderRadius: "6px",
            padding: "6px 14px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexShrink: 0,
            transition: "all 0.15s",
          }}>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "0.7rem", color: coin.color, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, letterSpacing: "0.08em" }}>
                {coin.symbol}
              </div>
              <div style={{ fontSize: "0.75rem" }}>
                $<PriceFlash price={p.price} decimals={coin.id === "btc" ? 0 : coin.id === "ada" || coin.id === "avax" ? 3 : 2} />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
              <Badge value={p.change24h} />
              <Sparkline data={p.sparkline} width={60} height={20} color={coin.color} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Module 2: Candlestick Chart ───────────────────────────────────────────────
const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1D"];

function CandlestickChart({ coinId }) {
  const prices = usePrices();
  const canvasRef = useRef(null);
  const [timeframe, setTimeframe] = useState("1h");
  const [candles, setCandles] = useState(() => {
    const coin = COINS.find(c => c.id === coinId) || COINS[0];
    return generateCandles(BASE_PRICES[coin.id]);
  });
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const coinData = COINS.find(c => c.id === coinId) || COINS[0];

  useEffect(() => {
    const price = prices[coinId]?.price;
    if (!price) return;
    setCandles(prev => {
      const last = prev[prev.length - 1];
      const updated = { ...last, c: price, h: Math.max(last.h, price), l: Math.min(last.l, price) };
      return [...prev.slice(0, -1), updated];
    });
  }, [prices, coinId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width = canvas.offsetWidth * devicePixelRatio;
    const H = canvas.height = canvas.offsetHeight * devicePixelRatio;
    ctx.scale(1, 1);

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, W, H);

    if (!candles.length) return;

    const padL = 0, padR = 60 * devicePixelRatio, padT = 20 * devicePixelRatio, padB = 40 * devicePixelRatio;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const visible = candles.slice(-50);
    const prices_arr = visible.flatMap(c => [c.h, c.l]);
    const pMin = Math.min(...prices_arr);
    const pMax = Math.max(...prices_arr);
    const pRange = pMax - pMin || 1;

    const toY = p => padT + chartH - ((p - pMin) / pRange) * chartH;
    const candleW = (chartW / visible.length) * 0.6;
    const gap = chartW / visible.length;

    // Grid lines
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padT + (chartH / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      const price = pMax - (pRange / 5) * i;
      ctx.fillStyle = "#444";
      ctx.font = `${10 * devicePixelRatio}px 'IBM Plex Mono'`;
      ctx.textAlign = "left";
      ctx.fillText("$" + price.toFixed(price > 100 ? 0 : 2), W - padR + 6, y + 4);
    }

    // Candles
    visible.forEach((c, i) => {
      const x = padL + gap * i + gap / 2;
      const isGreen = c.c >= c.o;
      const color = isGreen ? "#00e5ff" : "#ff4757";
      const halfW = candleW / 2;

      ctx.strokeStyle = color;
      ctx.lineWidth = devicePixelRatio;
      ctx.beginPath();
      ctx.moveTo(x, toY(c.h));
      ctx.lineTo(x, toY(c.l));
      ctx.stroke();

      const bodyTop = toY(Math.max(c.o, c.c));
      const bodyH = Math.max(Math.abs(toY(c.o) - toY(c.c)), devicePixelRatio);
      ctx.fillStyle = i === hoveredIdx ? color : color + "bb";
      ctx.fillRect(x - halfW, bodyTop, candleW, bodyH);
    });

    // MA line
    const period = 14;
    ctx.strokeStyle = coinData.color + "99";
    ctx.lineWidth = 1.5 * devicePixelRatio;
    ctx.beginPath();
    let started = false;
    visible.forEach((c, i) => {
      if (i < period) return;
      const avg = visible.slice(i - period, i).reduce((s, cc) => s + cc.c, 0) / period;
      const x = padL + gap * i + gap / 2;
      const y = toY(avg);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Volume bars at bottom
    const volMax = Math.max(...visible.map(c => c.v));
    const volH = 40 * devicePixelRatio;
    visible.forEach((c, i) => {
      const x = padL + gap * i + gap / 2;
      const isGreen = c.c >= c.o;
      ctx.fillStyle = (isGreen ? "#00e5ff" : "#ff4757") + "55";
      const barH = (c.v / volMax) * volH;
      ctx.fillRect(x - candleW / 2, H - padB - barH, candleW, barH);
    });

  }, [candles, hoveredIdx, coinData]);

  const hovered = hoveredIdx !== null ? candles.slice(-50)[hoveredIdx] : null;
  const lastCandle = candles[candles.length - 1];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0a0a0a" }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
          <span style={{ color: coinData.color, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: "1rem" }}>
            {coinData.symbol}/USDT
          </span>
          {lastCandle && (
            <span style={{ fontSize: "1.1rem" }}>
              $<PriceFlash price={lastCandle.c} decimals={coinId === "btc" ? 0 : 2} />
            </span>
          )}
          {lastCandle && <Badge value={((lastCandle.c - candles[0].o) / candles[0].o) * 100} />}
        </div>
        {hovered && (
          <div style={{ display: "flex", gap: "12px", fontSize: "0.7rem", fontFamily: "'IBM Plex Mono', monospace" }}>
            {[["O", hovered.o], ["H", hovered.h], ["L", hovered.l], ["C", hovered.c]].map(([k, v]) => (
              <span key={k} style={{ color: "#666" }}>{k}: <span style={{ color: "#aaa" }}>${v.toFixed(2)}</span></span>
            ))}
          </div>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
          {TIMEFRAMES.map(tf => (
            <button key={tf} onClick={() => setTimeframe(tf)} style={{
              padding: "3px 10px",
              background: tf === timeframe ? "#1e1e1e" : "transparent",
              border: `1px solid ${tf === timeframe ? "#333" : "transparent"}`,
              borderRadius: "4px",
              color: tf === timeframe ? "#e8e0d0" : "#555",
              cursor: "pointer",
              fontSize: "0.7rem",
              fontFamily: "'IBM Plex Mono', monospace",
              transition: "all 0.1s",
            }}>{tf}</button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }}
          onMouseMove={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const count = Math.min(50, candles.length);
            const gap = rect.width / count;
            const idx = Math.floor(x / gap);
            setHoveredIdx(idx >= 0 && idx < count ? idx : null);
          }}
          onMouseLeave={() => setHoveredIdx(null)}
        />
      </div>
    </div>
  );
}

// ─── Module 3: Order Book ──────────────────────────────────────────────────────
function OrderBook({ coinId }) {
  const prices = usePrices();
  const [book, setBook] = useState(() => generateOrderBook(BASE_PRICES[coinId] || 100));

  useEffect(() => {
    const price = prices[coinId]?.price;
    if (!price) return;
    setBook(generateOrderBook(price));
  }, [prices, coinId]);

  const fmt = v => v.toFixed(v > 1000 ? 0 : v > 10 ? 2 : 4);
  const fmtSize = v => v.toFixed(4);
  const mid = book.bids[0]?.price && book.asks[0]?.price
    ? (book.bids[0].price + book.asks[0].price) / 2 : 0;
  const spread = book.asks[0]?.price && book.bids[0]?.price
    ? ((book.asks[0].price - book.bids[0].price) / mid * 100).toFixed(3) : "—";

  return (
    <div style={{ background: "#0a0a0a", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #1a1a1a" }}>
        <span style={{ fontSize: "0.7rem", letterSpacing: "0.12em", color: "#666", fontFamily: "'IBM Plex Mono', monospace" }}>
          ORDER BOOK
        </span>
      </div>

      {/* Column headers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "6px 12px", gap: "4px" }}>
        {["PRICE (USDT)", "SIZE", "TOTAL"].map(h => (
          <span key={h} style={{ fontSize: "0.6rem", color: "#444", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em" }}>{h}</span>
        ))}
      </div>

      {/* Asks (reversed) */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {[...book.asks].reverse().map((a, i) => (
          <div key={i} style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "2px 12px", gap: "4px", overflow: "hidden" }}>
            <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: `${a.pct}%`, background: "#ff475708", pointerEvents: "none" }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", color: "#ff4757", zIndex: 1 }}>{fmt(a.price)}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", color: "#888", zIndex: 1 }}>{fmtSize(a.size)}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", color: "#555", zIndex: 1 }}>{fmtSize(a.total)}</span>
          </div>
        ))}
      </div>

      {/* Spread */}
      <div style={{ padding: "8px 12px", background: "#0d0d0d", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #1a1a1a", borderBottom: "1px solid #1a1a1a" }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.9rem", color: "#e8e0d0", fontWeight: 600 }}>
          ${fmt(mid)}
        </span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.6rem", color: "#555" }}>
          Spread: {spread}%
        </span>
      </div>

      {/* Bids */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {book.bids.map((b, i) => (
          <div key={i} style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "2px 12px", gap: "4px", overflow: "hidden" }}>
            <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: `${b.pct}%`, background: "#00e5ff08", pointerEvents: "none" }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", color: "#00e5ff", zIndex: 1 }}>{fmt(b.price)}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", color: "#888", zIndex: 1 }}>{fmtSize(b.size)}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", color: "#555", zIndex: 1 }}>{fmtSize(b.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Module 4: Portfolio Tracker ───────────────────────────────────────────────
const PORTFOLIO = [
  { coinId: "btc", amount: 0.42 },
  { coinId: "eth", amount: 3.15 },
  { coinId: "sol", amount: 48.0 },
  { coinId: "ada", amount: 4200 },
];
const COST_BASIS = { btc: 58000, eth: 2800, sol: 120, ada: 0.45 };

function PieChart({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  let cumAngle = -Math.PI / 2;
  const radius = 70, cx = 80, cy = 80;

  return (
    <svg width={160} height={160} style={{ display: "block" }}>
      {data.map((d, i) => {
        const angle = (d.value / total) * 2 * Math.PI;
        const x1 = cx + radius * Math.cos(cumAngle);
        const y1 = cy + radius * Math.sin(cumAngle);
        cumAngle += angle;
        const x2 = cx + radius * Math.cos(cumAngle);
        const y2 = cy + radius * Math.sin(cumAngle);
        const large = angle > Math.PI ? 1 : 0;
        const path = `M${cx},${cy} L${x1},${y1} A${radius},${radius} 0 ${large},1 ${x2},${y2} Z`;
        return <path key={i} d={path} fill={d.color} opacity={0.85} stroke="#0a0a0a" strokeWidth={2} />;
      })}
      <circle cx={cx} cy={cy} r={32} fill="#0a0a0a" />
    </svg>
  );
}

function PortfolioTracker() {
  const prices = usePrices();

  const positions = useMemo(() => PORTFOLIO.map(p => {
    const price = prices[p.coinId]?.price || BASE_PRICES[p.coinId];
    const value = price * p.amount;
    const cost = COST_BASIS[p.coinId] * p.amount;
    const pnl = value - cost;
    const pnlPct = (pnl / cost) * 100;
    const coin = COINS.find(c => c.id === p.coinId);
    return { ...p, price, value, cost, pnl, pnlPct, coin };
  }), [prices]);

  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  const totalCost = positions.reduce((s, p) => s + p.cost, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = (totalPnl / totalCost) * 100;

  const pieData = positions.map(p => ({ value: p.value, color: p.coin?.color || "#888" }));

  return (
    <div style={{ background: "#0a0a0a", padding: "16px", height: "100%", display: "flex", flexDirection: "column", gap: "16px", overflow: "auto" }}>
      <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
        <PieChart data={pieData} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.65rem", letterSpacing: "0.1em", color: "#555", fontFamily: "'IBM Plex Mono', monospace", marginBottom: "4px" }}>
            PORTFOLIO VALUE
          </div>
          <div style={{ fontSize: "1.6rem", color: "#e8e0d0", fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ marginTop: "8px", display: "flex", gap: "8px", alignItems: "center" }}>
            <Badge value={totalPnlPct} />
            <span style={{ fontSize: "0.75rem", color: totalPnl >= 0 ? "#00e5ff" : "#ff4757", fontFamily: "'IBM Plex Mono', monospace" }}>
              {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
            </span>
          </div>

          {/* Allocation bars */}
          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
            {positions.map(p => (
              <div key={p.coinId} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "32px", fontSize: "0.65rem", color: p.coin?.color, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>
                  {p.coin?.symbol}
                </span>
                <div style={{ flex: 1, height: "4px", background: "#1a1a1a", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ width: `${(p.value / totalValue) * 100}%`, height: "100%", background: p.coin?.color, transition: "width 0.5s ease" }} />
                </div>
                <span style={{ fontSize: "0.65rem", color: "#555", fontFamily: "'IBM Plex Mono', monospace", width: "36px", textAlign: "right" }}>
                  {((p.value / totalValue) * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Positions table */}
      <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: "12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "4px", marginBottom: "6px" }}>
          {["ASSET", "VALUE", "P&L", "24H"].map(h => (
            <span key={h} style={{ fontSize: "0.6rem", color: "#444", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em" }}>{h}</span>
          ))}
        </div>
        {positions.map(p => (
          <div key={p.coinId} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "4px", padding: "6px 0", borderTop: "1px solid #111" }}>
            <span style={{ fontSize: "0.75rem", color: p.coin?.color, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>
              {p.coin?.symbol}
            </span>
            <span style={{ fontSize: "0.75rem", color: "#aaa", fontFamily: "'IBM Plex Mono', monospace" }}>
              ${p.value.toFixed(0)}
            </span>
            <span style={{ fontSize: "0.75rem", color: p.pnl >= 0 ? "#00e5ff" : "#ff4757", fontFamily: "'IBM Plex Mono', monospace" }}>
              {p.pnl >= 0 ? "+" : ""}{p.pnlPct.toFixed(1)}%
            </span>
            <Badge value={prices[p.coinId]?.change24h || 0} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Module 5: Order Entry Panel ───────────────────────────────────────────────
function OrderPanel({ coinId }) {
  const prices = usePrices();
  const [side, setSide] = useState("buy");
  const [type, setType] = useState("market");
  const [quantity, setQuantity] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [lastOrder, setLastOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const price = prices[coinId]?.price || 0;
  const coinData = COINS.find(c => c.id === coinId) || COINS[0];
  const estimatedValue = quantity ? (parseFloat(quantity) * (type === "limit" ? parseFloat(limitPrice) || price : price)) : 0;

  const handleSubmit = () => {
    if (!quantity) return;
    setSubmitting(true);
    setTimeout(() => {
      setLastOrder({ side, type, quantity: parseFloat(quantity), price: type === "limit" ? parseFloat(limitPrice) : price, coinId, ts: Date.now() });
      setQuantity("");
      setLimitPrice("");
      setSubmitting(false);
    }, 800);
  };

  return (
    <div style={{ background: "#0a0a0a", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
      <span style={{ fontSize: "0.65rem", letterSpacing: "0.12em", color: "#555", fontFamily: "'IBM Plex Mono', monospace" }}>
        PLACE ORDER · {coinData.symbol}/USDT
      </span>

      {/* Buy/Sell toggle */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
        {["buy", "sell"].map(s => (
          <button key={s} onClick={() => setSide(s)} style={{
            padding: "9px",
            background: side === s ? (s === "buy" ? "#00e5ff18" : "#ff475718") : "transparent",
            border: `1px solid ${side === s ? (s === "buy" ? "#00e5ff55" : "#ff475755") : "#1e1e1e"}`,
            borderRadius: "5px",
            color: side === s ? (s === "buy" ? "#00e5ff" : "#ff4757") : "#444",
            cursor: "pointer",
            fontSize: "0.75rem",
            fontFamily: "'IBM Plex Mono', monospace",
            fontWeight: 700,
            letterSpacing: "0.08em",
            transition: "all 0.15s",
          }}>{s.toUpperCase()}</button>
        ))}
      </div>

      {/* Market/Limit */}
      <div style={{ display: "flex", gap: "4px" }}>
        {["market", "limit"].map(t => (
          <button key={t} onClick={() => setType(t)} style={{
            padding: "5px 12px",
            background: type === t ? "#1a1a1a" : "transparent",
            border: `1px solid ${type === t ? "#333" : "transparent"}`,
            borderRadius: "4px",
            color: type === t ? "#aaa" : "#444",
            cursor: "pointer",
            fontSize: "0.68rem",
            fontFamily: "'IBM Plex Mono', monospace",
            transition: "all 0.1s",
          }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {/* Price display */}
      <div style={{ padding: "8px 12px", background: "#0d0d0d", borderRadius: "5px", border: "1px solid #1a1a1a" }}>
        <div style={{ fontSize: "0.6rem", color: "#444", fontFamily: "'IBM Plex Mono', monospace", marginBottom: "2px" }}>
          {type === "market" ? "MARKET PRICE" : "LIMIT PRICE"}
        </div>
        {type === "market" ? (
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#e8e0d0" }}>
            $<PriceFlash price={price} decimals={coinId === "btc" ? 0 : 2} />
          </div>
        ) : (
          <input value={limitPrice} onChange={e => setLimitPrice(e.target.value)}
            placeholder={price.toFixed(2)}
            style={{
              background: "transparent", border: "none", outline: "none",
              color: "#e8e0d0", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.9rem", width: "100%",
            }} />
        )}
      </div>

      {/* Quantity */}
      <div style={{ padding: "8px 12px", background: "#0d0d0d", borderRadius: "5px", border: "1px solid #1a1a1a" }}>
        <div style={{ fontSize: "0.6rem", color: "#444", fontFamily: "'IBM Plex Mono', monospace", marginBottom: "2px" }}>
          QUANTITY ({coinData.symbol})
        </div>
        <input value={quantity} onChange={e => setQuantity(e.target.value)}
          placeholder="0.0000"
          style={{ background: "transparent", border: "none", outline: "none", color: "#e8e0d0", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.9rem", width: "100%" }} />
      </div>

      {/* Estimated value */}
      {quantity && (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 2px" }}>
          <span style={{ fontSize: "0.68rem", color: "#444", fontFamily: "'IBM Plex Mono', monospace" }}>Estimated Value</span>
          <span style={{ fontSize: "0.68rem", color: "#aaa", fontFamily: "'IBM Plex Mono', monospace" }}>
            ${estimatedValue.toFixed(2)}
          </span>
        </div>
      )}

      {/* Submit */}
      <button onClick={handleSubmit} disabled={!quantity || submitting} style={{
        padding: "11px",
        background: !quantity || submitting ? "#111" : (side === "buy" ? "#00e5ff18" : "#ff475718"),
        border: `1px solid ${!quantity || submitting ? "#1e1e1e" : (side === "buy" ? "#00e5ff66" : "#ff475766")}`,
        borderRadius: "5px",
        color: !quantity || submitting ? "#444" : (side === "buy" ? "#00e5ff" : "#ff4757"),
        cursor: !quantity || submitting ? "not-allowed" : "pointer",
        fontSize: "0.8rem",
        fontFamily: "'IBM Plex Mono', monospace",
        fontWeight: 700,
        letterSpacing: "0.1em",
        transition: "all 0.15s",
      }}>
        {submitting ? "SUBMITTING..." : `${side.toUpperCase()} ${coinData.symbol}`}
      </button>

      {/* Last order confirmation */}
      {lastOrder && (
        <div style={{ padding: "8px 12px", background: "#0d0d0d", borderRadius: "5px", border: "1px solid #00e5ff22" }}>
          <div style={{ fontSize: "0.6rem", color: "#00e5ff88", fontFamily: "'IBM Plex Mono', monospace", marginBottom: "4px", letterSpacing: "0.1em" }}>
            ✓ ORDER PLACED
          </div>
          <div style={{ fontSize: "0.7rem", color: "#666", fontFamily: "'IBM Plex Mono', monospace" }}>
            {lastOrder.side.toUpperCase()} {lastOrder.quantity} {COINS.find(c => c.id === lastOrder.coinId)?.symbol} @ ${lastOrder.price.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Trade History Feed ────────────────────────────────────────────────────────
function TradeFeed({ coinId }) {
  const prices = usePrices();
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    const price = prices[coinId]?.price;
    if (!price) return;
    const t = {
      id: Date.now(),
      side: Math.random() > 0.5 ? "buy" : "sell",
      price: price * (1 + (Math.random() - 0.5) * 0.001),
      size: Math.random() * 2 + 0.01,
      ts: Date.now(),
    };
    setTrades(prev => [t, ...prev].slice(0, 30));
  }, [prices, coinId]);

  const fmt = p => p > 1000 ? p.toFixed(0) : p.toFixed(4);

  return (
    <div style={{ background: "#0a0a0a", overflow: "hidden", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #1a1a1a" }}>
        <span style={{ fontSize: "0.65rem", letterSpacing: "0.12em", color: "#555", fontFamily: "'IBM Plex Mono', monospace" }}>
          TRADE HISTORY
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "6px 12px" }}>
        {["PRICE", "SIZE", "TIME"].map(h => (
          <span key={h} style={{ fontSize: "0.6rem", color: "#333", fontFamily: "'IBM Plex Mono', monospace" }}>{h}</span>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
        {trades.map((t, i) => (
          <div key={t.id} style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
            padding: "2px 12px",
            opacity: 1 - i * 0.03,
            animation: i === 0 ? "fadeIn 0.2s ease" : undefined,
          }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", color: t.side === "buy" ? "#00e5ff" : "#ff4757" }}>
              {fmt(t.price)}
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", color: "#666" }}>
              {t.size.toFixed(4)}
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "#444" }}>
              {new Date(t.ts).toLocaleTimeString("en-US", { hour12: false })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Wallet Panel ─────────────────────────────────────────────────────────────
function WalletPanel() {
  const [connected, setConnected] = useState(false);
  const [tab, setTab] = useState("balances");

  const balances = [
    { symbol: "BTC", amount: 0.42, usd: 28316, color: "#f7931a" },
    { symbol: "ETH", amount: 3.15, usd: 11277, color: "#627eea" },
    { symbol: "USDT", amount: 5420.11, usd: 5420, color: "#26a17b" },
  ];

  const txHistory = [
    { type: "receive", symbol: "ETH", amount: 1.5, usd: 5370, time: "2h ago", status: "confirmed", hash: "0xf4a2...e1b9" },
    { type: "send", symbol: "BTC", amount: 0.08, usd: 5394, time: "1d ago", status: "confirmed", hash: "0xa91c...7f22" },
    { type: "receive", symbol: "USDT", amount: 2000, usd: 2000, time: "3d ago", status: "confirmed", hash: "0x3c8d...aa01" },
  ];

  if (!connected) return (
    <div style={{ background: "#0a0a0a", padding: "24px 16px", display: "flex", flexDirection: "column", gap: "16px", height: "100%", justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: "8px" }}>⬡</div>
        <div style={{ fontSize: "0.85rem", color: "#aaa", fontFamily: "'IBM Plex Mono', monospace", marginBottom: "4px" }}>Connect Wallet</div>
        <div style={{ fontSize: "0.7rem", color: "#444", fontFamily: "'IBM Plex Mono', monospace" }}>Access balances and transaction history</div>
      </div>
      {[["MetaMask", "#f5a623"], ["WalletConnect", "#3b99fc"], ["Coinbase", "#0052ff"]].map(([name, color]) => (
        <button key={name} onClick={() => setConnected(true)} style={{
          padding: "10px 32px",
          background: "transparent",
          border: `1px solid ${color}55`,
          borderRadius: "6px",
          color: color,
          cursor: "pointer",
          fontSize: "0.75rem",
          fontFamily: "'IBM Plex Mono', monospace",
          width: "100%",
          maxWidth: "200px",
          transition: "all 0.15s",
        }}>{name}</button>
      ))}
    </div>
  );

  return (
    <div style={{ background: "#0a0a0a", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.65rem", letterSpacing: "0.12em", color: "#555", fontFamily: "'IBM Plex Mono', monospace" }}>WALLET</span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00e5ff", boxShadow: "0 0 6px #00e5ff" }} />
          <span style={{ fontSize: "0.65rem", color: "#555", fontFamily: "'IBM Plex Mono', monospace" }}>0x4f...8a2c</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "4px", padding: "10px 16px", borderBottom: "1px solid #1a1a1a" }}>
        {["balances", "history"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "4px 12px",
            background: tab === t ? "#1a1a1a" : "transparent",
            border: `1px solid ${tab === t ? "#333" : "transparent"}`,
            borderRadius: "4px",
            color: tab === t ? "#aaa" : "#444",
            cursor: "pointer",
            fontSize: "0.68rem",
            fontFamily: "'IBM Plex Mono', monospace",
            transition: "all 0.1s",
          }}>{t.toUpperCase()}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "12px" }}>
        {tab === "balances" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {balances.map(b => (
              <div key={b.symbol} style={{ padding: "10px 12px", background: "#0d0d0d", borderRadius: "6px", border: "1px solid #1a1a1a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", color: b.color, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>{b.symbol}</div>
                  <div style={{ fontSize: "0.7rem", color: "#666", fontFamily: "'IBM Plex Mono', monospace" }}>{b.amount}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.8rem", color: "#e8e0d0", fontFamily: "'IBM Plex Mono', monospace" }}>${b.usd.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {txHistory.map((tx, i) => (
              <div key={i} style={{ padding: "10px 12px", background: "#0d0d0d", borderRadius: "6px", border: "1px solid #1a1a1a" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontSize: "0.72rem", color: tx.type === "receive" ? "#00e5ff" : "#ff4757", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>
                    {tx.type === "receive" ? "▼" : "▲"} {tx.type.toUpperCase()} {tx.symbol}
                  </span>
                  <span style={{ fontSize: "0.7rem", color: "#aaa", fontFamily: "'IBM Plex Mono', monospace" }}>${tx.usd.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.62rem", color: "#444", fontFamily: "'IBM Plex Mono', monospace" }}>{tx.hash}</span>
                  <span style={{ fontSize: "0.62rem", color: "#333", fontFamily: "'IBM Plex Mono', monospace" }}>{tx.time}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function CryptoDashboard() {
  const [selectedCoin, setSelectedCoin] = useState("btc");
  const [rightPanel, setRightPanel] = useState("orderbook");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=Syne:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0a; color: #e8e0d0; font-family: 'Syne', sans-serif; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #0a0a0a; }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)} }
      `}</style>

      <PriceProvider>
        <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", background: "#0a0a0a", overflow: "hidden" }}>

          {/* Top bar */}
          <div style={{ padding: "0 24px", height: "44px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1a1a1a", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "1.05rem", letterSpacing: "0.04em", color: "#f5a623" }}>
                ◈ CRYPTEX
              </span>
              <span style={{ fontSize: "0.6rem", color: "#333", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.12em" }}>
                TERMINAL v2.4.1
              </span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {["orderbook", "portfolio", "wallet"].map(p => (
                <button key={p} onClick={() => setRightPanel(p)} style={{
                  padding: "4px 12px",
                  background: rightPanel === p ? "#1a1a1a" : "transparent",
                  border: `1px solid ${rightPanel === p ? "#2a2a2a" : "transparent"}`,
                  borderRadius: "4px",
                  color: rightPanel === p ? "#aaa" : "#444",
                  cursor: "pointer",
                  fontSize: "0.65rem",
                  fontFamily: "'IBM Plex Mono', monospace",
                  letterSpacing: "0.08em",
                  transition: "all 0.1s",
                }}>{p.toUpperCase()}</button>
              ))}
            </div>
          </div>

          {/* Ticker */}
          <div style={{ flexShrink: 0 }}>
            <TickerStrip onSelectCoin={setSelectedCoin} selectedCoin={selectedCoin} />
          </div>

          {/* Main content */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 220px 260px", gridTemplateRows: "1fr", minHeight: 0, gap: "1px", background: "#1a1a1a" }}>

            {/* Chart */}
            <div style={{ background: "#0a0a0a", display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ flex: 1, minHeight: 0 }}>
                <CandlestickChart coinId={selectedCoin} />
              </div>
              {/* Order entry below chart */}
              <div style={{ flexShrink: 0, borderTop: "1px solid #1a1a1a" }}>
                <OrderPanel coinId={selectedCoin} />
              </div>
            </div>

            {/* Trade feed */}
            <div style={{ background: "#0a0a0a", minHeight: 0 }}>
              <TradeFeed coinId={selectedCoin} />
            </div>

            {/* Right panel */}
            <div style={{ background: "#0a0a0a", overflow: "hidden" }}>
              {rightPanel === "orderbook" && <OrderBook coinId={selectedCoin} />}
              {rightPanel === "portfolio" && <PortfolioTracker />}
              {rightPanel === "wallet" && <WalletPanel />}
            </div>
          </div>
        </div>
      </PriceProvider>
    </>
  );
}
