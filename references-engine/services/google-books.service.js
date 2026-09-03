/* google-books.service — LIVROS */
import { createReference } from '../types/reference.types.js';
const GB='https://www.googleapis.com/books/v1/volumes';
export async function searchGoogleBooks(query, {limit=10}={}){
  const url=`${GB}?q=${encodeURIComponent(query)}&maxResults=${limit}`;
  const r=await fetch(url);
  if(!r.ok) throw new Error(`GB ${r.status}`);
  const d=await r.json();
  return (d.items||[]).map(it=>{
    const v=it.volumeInfo||{};
    return createReference({
      title: v.title, authors:(v.authors||[]).map(n=>({name:n})),
      publicationYear: v.publishedDate? parseInt(v.publishedDate.slice(0,4)):null,
      publisher: v.publisher||null, isbn: (v.industryIdentifiers||[]).find(x=>x.type.includes('ISBN'))?.identifier||null,
      url: v.infoLink, language: v.language, documentType:'book',
      source:'google_books', verificationStatus:'PARCIALMENTE_VERIFICADA'
    });
  });
}
