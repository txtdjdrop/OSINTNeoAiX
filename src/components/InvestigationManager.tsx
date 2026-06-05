import React, { useState } from 'react';
import { Entity, Relationship, Evidence } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function InvestigationManager() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Entities</CardTitle>
          <CardDescription>Manage people, orgs, and properties</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {entities.map(e => (
              <div key={e.id} className="p-2 border rounded">{e.name} ({e.type})</div>
            ))}
            <Button className="w-full">Add Entity</Button>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Relationships</CardTitle>
          <CardDescription>Define connections (The Matrix)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {relationships.map(r => (
              <div key={r.id} className="p-2 border rounded">{r.type}: {r.sourceEntityId} -&gt; {r.targetEntityId}</div>
            ))}
            <Button className="w-full">Add Relationship</Button>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Evidence</CardTitle>
          <CardDescription>Link documents and records</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {evidence.map(ev => (
              <div key={ev.id} className="p-2 border rounded">{ev.title}</div>
            ))}
            <Button className="w-full">Add Evidence</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
