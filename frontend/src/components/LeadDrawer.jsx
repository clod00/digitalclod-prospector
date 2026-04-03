import { useState } from 'react'
import {
  X, Globe, MapPin, Phone, Mail, Instagram, Facebook, Zap,
  Copy, Check, ExternalLink, Sparkles, Edit3, CheckCircle2
} from 'lucide-react'
import ScoreBadge from './ScoreBadge'
import ScoreBreakdown from './ScoreBreakdown'
import StatusBadge from './StatusBadge'
import { enrichLead, generateAI, updateLead } from '../lib/api'

const STATUS_OPTIONS = ['da_contattare', 'contattato', 'risposto', 'cliente']
const STATUS_LABELS = {
  da_contattare: 'Da contattare',
  contattato: 'Contattato',
  risposto: 'Risposto',
  cliente: 'Cliente ✓',
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-text-secondary hover:text-accent transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copiato!' : 'Copia'}
    </button>
  )
}

export default function LeadDrawer({ lead: initialLead, onClose, onUpdate }) {
  const [lead, setLead] = useState(initialLead)
  const [enriching, setEnriching] = useState(false)
  const [generatingAI, setGeneratingAI] = useState(false)
  const [note, setNote] = useState(initialLead?.note || '')
  const [savingNote, setSavingNote] = useState(false)
  const [activeTab, setActiveTab] = useState('info')

  const handleEnrich = async () => {
    setEnriching(true)
    try {
      const { data } = await enrichLead(lead.id)
      setLead(data)
      onUpdate(data)
    } catch (err) {
      alert('Errore enrichment: ' + err.message)
    } finally {
      setEnriching(false)
    }
  }

  const handleGenerateAI = async () => {
    setGeneratingAI(true)
    try {
      const { data } = await generateAI(lead.id)
      setLead(data)
      onUpdate(data)
      setActiveTab('ai')
    } catch (err) {
      alert('Errore AI: ' + err.message)
    } finally {
      setGeneratingAI(false)
    }
  }

  const handleStatusChange = async (stato) => {
    try {
      const { data } = await updateLead(lead.id, { stato })
      setLead(data)
      onUpdate(data)
    } catch (err) {
      alert('Errore aggiornamento stato')
    }
  }

  const handleSaveNote = async () => {
    setSavingNote(true)
    try {
      const { data } = await updateLead(lead.id, { note })
      setLead(data)
      onUpdate(data)
    } catch (err) {
      alert('Errore salvataggio nota')
    } finally {
      setSavingNote(false)
    }
  }

  const aiOggetti = (() => {
    try { return JSON.parse(lead.ai_oggetto_ab || '[]') } catch { return [] }
  })()
  const aiIdee = (() => {
    try { return JSON.parse(lead.ai_idee_automazione || '[]') } catch { return [] }
  })()

  const tabs = [
    { key: 'info', label: 'Info' },
    { key: 'score', label: 'Score' },
    { key: 'ai', label: 'AI Output', hasContent: !!lead.ai_email_template },
  ]

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-[520px] bg-surface border-l border-border z-50 flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-text-primary truncate">{lead.ragione_sociale}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {lead.citta && <span className="text-xs text-text-secondary flex items-center gap-0.5"><MapPin className="w-3 h-3" />{lead.citta}</span>}
              {lead.settore && <span className="text-xs text-text-secondary">{lead.settore}</span>}
              {lead.score_totale != null && <ScoreBadge score={lead.score_totale} tier={lead.score_tier} />}
            </div>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary ml-3 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border shrink-0">
          <button
            onClick={handleEnrich}
            disabled={enriching}
            className="flex items-center gap-1.5 bg-surface-2 hover:bg-border disabled:opacity-50 text-text-primary px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-border"
          >
            <Zap className={`w-4 h-4 text-accent ${enriching ? 'animate-pulse' : ''}`} />
            {enriching ? 'Analizzando...' : 'Enrichment'}
          </button>

          <button
            onClick={handleGenerateAI}
            disabled={generatingAI}
            className="flex items-center gap-1.5 bg-accent/10 hover:bg-accent/20 disabled:opacity-50 text-accent px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-accent/30"
          >
            <Sparkles className={`w-4 h-4 ${generatingAI ? 'animate-spin' : ''}`} />
            {generatingAI ? 'Generando...' : 'Genera AI'}
          </button>

          {/* Status select */}
          <select
            value={lead.stato || 'da_contattare'}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="ml-auto bg-surface-2 border border-border text-text-secondary text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-accent"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 shrink-0 border-b border-border">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1 ${
                activeTab === tab.key
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
              {tab.hasContent && <span className="w-1.5 h-1.5 rounded-full bg-success" />}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'info' && (
            <>
              {/* Contact info */}
              <div className="bg-surface-2 rounded-xl p-4 border border-border space-y-3">
                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Contatto</h4>
                {lead.telefono && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted" />
                    <a href={`tel:${lead.telefono}`} className="text-text-primary hover:text-accent">{lead.telefono}</a>
                  </div>
                )}
                {lead.email_trovata && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted" />
                    <a href={`mailto:${lead.email_trovata}`} className="text-text-primary hover:text-accent truncate">{lead.email_trovata}</a>
                    <CopyButton text={lead.email_trovata} />
                  </div>
                )}
                {lead.sito_web && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="w-4 h-4 text-muted" />
                    <a href={lead.sito_web.startsWith('http') ? lead.sito_web : `https://${lead.sito_web}`} target="_blank" rel="noreferrer" className="text-accent hover:underline truncate flex items-center gap-1">
                      {lead.sito_web} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                {lead.indirizzo_fisico && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted mt-0.5" />
                    <span className="text-text-primary">{lead.indirizzo_fisico}</span>
                  </div>
                )}
                {lead.piva && (
                  <div className="text-xs text-text-secondary">P.IVA: {lead.piva}</div>
                )}
              </div>

              {/* Website analysis */}
              {lead.enriched_at && (
                <div className="bg-surface-2 rounded-xl p-4 border border-border">
                  <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Analisi Web</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Sito attivo', val: lead.sito_esiste ? '✅ Sì' : '❌ No' },
                      { label: 'PageSpeed', val: lead.sito_pagespeed != null ? `${lead.sito_pagespeed}/100` : '—' },
                      { label: 'Meta Pixel', val: lead.sito_ha_pixel ? '✅ Presente' : '❌ Assente' },
                      { label: 'Email provider', val: lead.sito_email_provider || '—' },
                      { label: 'FB Ads', val: lead.fa_ads_attivi ? '✅ Attivi' : '❌ Assenti' },
                    ].map(({ label, val }) => (
                      <div key={label} className="text-xs">
                        <span className="text-text-secondary">{label}:</span>
                        <span className="text-text-primary ml-1">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Social */}
              <div className="bg-surface-2 rounded-xl p-4 border border-border">
                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Social</h4>
                <div className="flex items-center gap-4">
                  {lead.social_instagram_url ? (
                    <a href={lead.social_instagram_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-pink-400 hover:text-pink-300">
                      <Instagram className="w-4 h-4" />
                      {lead.social_instagram_follower != null ? `${lead.social_instagram_follower} follower` : 'Instagram'}
                    </a>
                  ) : (
                    <span className="flex items-center gap-2 text-sm text-muted opacity-40"><Instagram className="w-4 h-4" />Instagram assente</span>
                  )}
                  {lead.social_facebook_url ? (
                    <a href={lead.social_facebook_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
                      <Facebook className="w-4 h-4" />Facebook
                    </a>
                  ) : (
                    <span className="flex items-center gap-2 text-sm text-muted opacity-40"><Facebook className="w-4 h-4" />Facebook assente</span>
                  )}
                </div>
              </div>

              {/* Google Maps */}
              {lead.gmaps_stelle != null && (
                <div className="bg-surface-2 rounded-xl p-4 border border-border">
                  <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Google Maps</h4>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-amber">{lead.gmaps_stelle?.toFixed(1)}</div>
                      <div className="text-xs text-text-secondary">stelle</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-text-primary">{lead.gmaps_recensioni ?? 0}</div>
                      <div className="text-xs text-text-secondary">recensioni</div>
                    </div>
                    {lead.gmaps_foto != null && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-text-primary">{lead.gmaps_foto}</div>
                        <div className="text-xs text-text-secondary">foto</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="bg-surface-2 rounded-xl p-4 border border-border">
                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Note</h4>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Aggiungi note su questo lead..."
                  className="w-full bg-bg border border-border rounded-lg p-3 text-sm text-text-primary placeholder-text-secondary resize-none focus:outline-none focus:border-accent"
                  rows={3}
                />
                <button
                  onClick={handleSaveNote}
                  disabled={savingNote || note === (lead.note || '')}
                  className="mt-2 flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {savingNote ? 'Salvando...' : 'Salva nota'}
                </button>
              </div>
            </>
          )}

          {activeTab === 'score' && (
            <ScoreBreakdown
              breakdown={lead.score_breakdown}
              score={lead.score_totale}
              tier={lead.score_tier}
            />
          )}

          {activeTab === 'ai' && (
            <>
              {!lead.ai_email_template ? (
                <div className="text-center py-12 text-text-secondary">
                  <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">AI Output non ancora generato</p>
                  <p className="text-sm mt-1">Clicca "Genera AI" per creare email, idee e hook WhatsApp</p>
                </div>
              ) : (
                <>
                  {/* Subject lines A/B */}
                  {aiOggetti.length > 0 && (
                    <div className="bg-surface-2 rounded-xl p-4 border border-border">
                      <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Oggetto Email A/B</h4>
                      {aiOggetti.map((obj, i) => (
                        <div key={i} className="flex items-center justify-between bg-bg rounded-lg p-3 mb-2">
                          <span className="text-sm text-text-primary flex-1 mr-2">{obj}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted">{i === 0 ? 'A' : 'B'}</span>
                            <CopyButton text={obj} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Email template */}
                  <div className="bg-surface-2 rounded-xl p-4 border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Template Email</h4>
                      <CopyButton text={lead.ai_email_template} />
                    </div>
                    <pre className="text-sm text-text-primary whitespace-pre-wrap font-sans bg-bg rounded-lg p-3 max-h-64 overflow-y-auto">
                      {lead.ai_email_template}
                    </pre>
                  </div>

                  {/* WhatsApp hook */}
                  {lead.ai_whatsapp_hook && (
                    <div className="bg-surface-2 rounded-xl p-4 border border-border">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Hook WhatsApp</h4>
                        <CopyButton text={lead.ai_whatsapp_hook} />
                      </div>
                      <div className="bg-[#1a2e24] border border-[#25d366]/20 rounded-xl p-3 text-sm text-text-primary">
                        {lead.ai_whatsapp_hook}
                      </div>
                    </div>
                  )}

                  {/* Automation ideas */}
                  {aiIdee.length > 0 && (
                    <div className="bg-surface-2 rounded-xl p-4 border border-border">
                      <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Top 3 Idee Automazione</h4>
                      <div className="space-y-2">
                        {aiIdee.map((idea, i) => (
                          <div key={i} className="flex items-start gap-3 bg-bg rounded-lg p-3">
                            <span className="shrink-0 w-5 h-5 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center">{i + 1}</span>
                            <p className="text-sm text-text-primary">{idea}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
