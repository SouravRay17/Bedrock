import React from 'react';
import CandlestickChart from '../CandlestickChart';

export default function CandlestickGraph({ data = [], symbol = 'STK', title = 'Financial Market Price Action' }) {
  return (
    <CandlestickChart data={data} symbol={symbol} title={title} />
  );
}
