import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Upload, FileText, ChevronDown, ChevronRight, Loader2, CheckCircle, UserPlus, SkipForward } from 'lucide-react';
import { api } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SingleImportResult {
  matched: boolean;
  beneficiaryId?: string;
  action: 'created' | 'updated' | 'skipped';
}

interface BatchImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    values.push(current.trim());
    const record: Record<string, string> = {};
    headers.forEach((h, i) => { if (values[i]) record[h] = values[i]; });
    return record;
  }).filter(r => Object.keys(r).length > 0);
}

function parseJSON(text: string): Record<string, string>[] {
  const data = JSON.parse(text);
  if (Array.isArray(data)) return data;
  if (data.records && Array.isArray(data.records)) return data.records;
  return [];
}

export function LcrImportTab() {
  const [showManual, setShowManual] = useState(false);
  const [importing, setImporting] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchImportResult | null>(null);
  const [singleResult, setSingleResult] = useState<SingleImportResult | null>(null);
  const [parsedRecords, setParsedRecords] = useState<Record<string, string>[] | null>(null);
  const [parsedFileName, setParsedFileName] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    philsysNumber: '',
    surname: '',
    firstName: '',
    middleName: '',
    dob: '',
    gender: '',
    address: '',
    recordType: 'birth',
  });

  function handleFormChange(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.surname || !form.firstName || !form.dob) {
      toast.error('Surname, First Name, and Date of Birth are required.');
      return;
    }
    setImporting(true);
    setSingleResult(null);
    try {
      const body: Record<string, unknown> = { ...form };
      if (!body.philsysNumber) delete body.philsysNumber;
      if (!body.middleName) delete body.middleName;
      if (!body.address) delete body.address;
      if (!body.gender) delete body.gender;
      const result = await api.post<SingleImportResult>('/lcr/import', body);
      setSingleResult(result);
      toast.success(`Record ${result.action} successfully.`);
    } catch (err: any) {
      toast.error(err?.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  }

  function handleFileSelect(file: File | undefined | null) {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const records = ext === 'json' ? parseJSON(text) : parseCSV(text);
        if (records.length === 0) {
          toast.error('No records found in file.');
          return;
        }
        setParsedRecords(records);
        setParsedFileName(file.name);
        setBatchResult(null);
        toast.success(`Parsed ${records.length} record(s) from ${file.name}`);
      } catch {
        toast.error('Failed to parse file. Check the format.');
      }
    };
    reader.readAsText(file);
  }

  async function handleBatchImport() {
    if (!parsedRecords || parsedRecords.length === 0) return;
    setImporting(true);
    try {
      const result = await api.post<BatchImportResult>('/lcr/import-batch', { records: parsedRecords });
      setBatchResult(result);
      toast.success(`Import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped.`);
    } catch (err: any) {
      toast.error(err?.message || 'Batch import failed.');
    } finally {
      setImporting(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files[0]);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function clearFile() {
    setParsedRecords(null);
    setParsedFileName('');
    setBatchResult(null);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Batch Import from File
          </CardTitle>
          <CardDescription>
            Upload a CSV or JSON file containing LCR records. CSV must have headers matching the field names.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!parsedRecords ? (
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-1">
                Drag & drop a file here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground">Supports .csv and .json files</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                className="hidden"
                onChange={e => handleFileSelect(e.target.files?.[0])}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">{parsedFileName}</p>
                    <p className="text-sm text-muted-foreground">{parsedRecords.length} record(s) parsed</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={clearFile} disabled={importing}>
                    Clear
                  </Button>
                  <Button size="sm" onClick={handleBatchImport} disabled={importing}>
                    {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                    Import {parsedRecords.length} Record{parsedRecords.length > 1 ? 's' : ''}
                  </Button>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      {Object.keys(parsedRecords[0] || {}).slice(0, 6).map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                      ))}
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">...</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRecords.slice(0, 50).map((rec, i) => (
                      <tr key={i} className="border-t">
                        {Object.keys(parsedRecords[0] || {}).slice(0, 6).map(h => (
                          <td key={h} className="px-3 py-1.5 truncate max-w-[150px]">{rec[h] || ''}</td>
                        ))}
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {Object.keys(rec).length > 6 ? `+${Object.keys(rec).length - 6}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRecords.length > 50 && (
                  <p className="p-2 text-xs text-muted-foreground text-center border-t">
                    Showing 50 of {parsedRecords.length} records
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {batchResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Batch Import Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <p className="text-2xl font-bold">{batchResult.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="p-4 bg-alert-success-bg rounded-lg text-center">
                <p className="text-2xl font-bold text-alert-success-fg">{batchResult.created}</p>
                <p className="text-xs text-muted-foreground">Created</p>
              </div>
              <div className="p-4 bg-blue-100 text-blue-700 rounded-lg text-center">
                <p className="text-2xl font-bold">{batchResult.updated}</p>
                <p className="text-xs text-muted-foreground">Updated</p>
              </div>
              <div className="p-4 bg-alert-error-bg rounded-lg text-center">
                <p className="text-2xl font-bold text-alert-error-fg">{batchResult.skipped}</p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setShowManual(!showManual)}>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Manual Single Record Import
            </CardTitle>
            <Button variant="ghost" size="sm">
              {showManual ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {showManual && (
          <CardContent>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="philsysNumber">Philsys Number</Label>
                  <Input
                    id="philsysNumber"
                    placeholder="e.g. 1234-5678901-2"
                    value={form.philsysNumber}
                    onChange={e => handleFormChange('philsysNumber', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recordType">Record Type</Label>
                  <Select value={form.recordType} onValueChange={v => handleFormChange('recordType', v)}>
                    <SelectTrigger id="recordType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="birth">Birth</SelectItem>
                      <SelectItem value="marriage">Marriage</SelectItem>
                      <SelectItem value="death">Death</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="surname">Surname *</Label>
                  <Input
                    id="surname"
                    required
                    value={form.surname}
                    onChange={e => handleFormChange('surname', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    required
                    value={form.firstName}
                    onChange={e => handleFormChange('firstName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="middleName">Middle Name</Label>
                  <Input
                    id="middleName"
                    value={form.middleName}
                    onChange={e => handleFormChange('middleName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth *</Label>
                  <Input
                    id="dob"
                    type="date"
                    required
                    value={form.dob}
                    onChange={e => handleFormChange('dob', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select value={form.gender} onValueChange={v => handleFormChange('gender', v)}>
                    <SelectTrigger id="gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={form.address}
                    onChange={e => handleFormChange('address', e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={importing}>
                  {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                  Import Record
                </Button>
              </div>
            </form>

            {singleResult && (
              <div className="mt-4 p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {singleResult.action === 'created' ? (
                    <UserPlus className="h-5 w-5 text-green-500" />
                  ) : singleResult.action === 'updated' ? (
                    <CheckCircle className="h-5 w-5 text-blue-500" />
                  ) : (
                    <SkipForward className="h-5 w-5 text-yellow-500" />
                  )}
                  <span className="font-medium capitalize">{singleResult.action}</span>
                  <Badge variant={singleResult.matched ? 'default' : 'secondary'}>
                    {singleResult.matched ? 'Matched' : 'New'}
                  </Badge>
                </div>
                {singleResult.beneficiaryId && (
                  <p className="text-sm text-muted-foreground">
                    Beneficiary ID: {singleResult.beneficiaryId}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
