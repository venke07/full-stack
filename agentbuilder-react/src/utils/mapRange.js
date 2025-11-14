export default function mapRange(v, labels) {
  const i = Math.round((v / 100) * (labels.length - 1));
  return labels[i];
}