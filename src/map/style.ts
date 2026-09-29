// 下地の地図のスタイル。
// 答えが見えないように、文字（注記）・線路・駅・建物は出さない（要件定義書 9章、12.1）。
// 使うのは水域、河川、行政界、主な道路だけ。

import type { StyleSpecification } from 'maplibre-gl'

export const MAP_ATTRIBUTION =
  '<a href="https://github.com/gsi-cyberjapan/optimal_bvmap" target="_blank" rel="noopener">国土地理院最適化ベクトルタイル</a>'

export const baseColors = {
  background: '#fff7ef',
  water: '#cde9f6',
  river: '#a8d8f0',
  cityBoundary: '#e3cfc3',
  prefBoundary: '#caa996',
  road: '#f6e2cf',
}

export const baseStyle: StyleSpecification = {
  version: 8,
  sources: {
    gsi: {
      type: 'vector',
      tiles: [
        'https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/{z}/{x}/{y}.pbf',
      ],
      minzoom: 4,
      maxzoom: 16,
      attribution: MAP_ATTRIBUTION,
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': baseColors.background },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'gsi',
      'source-layer': 'WA',
      paint: { 'fill-color': baseColors.water },
    },
    {
      id: 'river',
      type: 'line',
      source: 'gsi',
      'source-layer': 'RvrCL',
      filter: ['!', ['in', ['get', 'vt_code'], ['literal', [5302, 5322]]]],
      paint: {
        'line-color': baseColors.river,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 15, 2],
      },
    },
    {
      id: 'road',
      type: 'line',
      source: 'gsi',
      'source-layer': 'RdCL',
      filter: [
        'in',
        ['get', 'vt_rdctg'],
        ['literal', ['高速自動車国道等', '国道', '主要道路']],
      ],
      paint: {
        'line-color': baseColors.road,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 15, 4],
      },
    },
    {
      id: 'city-boundary',
      type: 'line',
      source: 'gsi',
      'source-layer': 'AdmBdry',
      filter: ['==', ['get', 'vt_code'], 1212],
      paint: {
        'line-color': baseColors.cityBoundary,
        'line-width': 1,
        'line-dasharray': [3, 2],
      },
    },
    {
      id: 'pref-boundary',
      type: 'line',
      source: 'gsi',
      'source-layer': 'AdmBdry',
      filter: ['==', ['get', 'vt_code'], 1211],
      paint: { 'line-color': baseColors.prefBoundary, 'line-width': 2 },
    },
  ],
}
