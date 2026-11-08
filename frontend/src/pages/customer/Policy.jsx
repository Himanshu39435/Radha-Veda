import { useParams } from 'react-router-dom';
import { useSettings } from '../../components/ShopLayout';
import { Spinner } from '../../components/ui';
const T = { returnPolicy: 'Return policy', privacyPolicy: 'Privacy policy', terms: 'Terms and conditions' };
export default function Policy() { const { key } = useParams(); const { data } = useSettings(); if (!data) return <Spinner />; return <div className="container-x max-w-3xl py-10"><h1 className="mb-4 text-5xl font-semibold">{T[key] || 'Policy'}</h1><p className="whitespace-pre-line leading-relaxed">{data[key] || 'Not published yet.'}</p></div>; }
