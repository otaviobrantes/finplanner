
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend, LineChart, Line } from 'recharts';
import { Asset, Transaction } from '../types';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ff7300', '#a4de6c', '#d0ed57', '#8dd1e1'];

interface ProjectionsProps {
  data: { year: number; value: number; invested: number }[];
}

export const PatrimonyChart: React.FC<ProjectionsProps> = ({ data }) => {
  if (!data || data.length === 0) return <div className="h-72 w-full flex items-center justify-center text-gray-400 text-xs">Sem dados para projeção</div>;

  return (
    <div className="h-72 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00C49F" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#00C49F" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis dataKey="year" />
          <YAxis tickFormatter={(val) => `R$${(val/1000).toFixed(0)}k`} />
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <Tooltip formatter={(val: number) => `R$ ${val.toLocaleString('pt-BR', {maximumFractionDigits: 0})}`} />
          <Legend />
          <Area type="monotone" dataKey="value" stroke="#00C49F" fillOpacity={1} fill="url(#colorValue)" name="Patrimônio Total" />
          <Area type="monotone" dataKey="invested" stroke="#8884d8" fillOpacity={1} fill="url(#colorInvested)" name="Total Aportado" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

interface ScenarioProps {
  data: { year: number; pessimistic: number; realistic: number; optimistic: number }[];
}

export const ScenarioChart: React.FC<ScenarioProps> = ({ data }) => {
  if (!data || data.length === 0) return <div className="h-80 w-full flex items-center justify-center text-gray-400 text-xs">Sem dados de cenário</div>;

  return (
    <div className="h-80 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="year" />
          <YAxis tickFormatter={(val) => `R$${(val/1000).toFixed(0)}k`} />
          <Tooltip formatter={(val: number) => `R$ ${val.toLocaleString('pt-BR', {maximumFractionDigits: 0})}`} />
          <Legend />
          <Line type="monotone" dataKey="pessimista" stroke="#FF8042" strokeWidth={2} name="Cenário Pessimista (4%)" dot={false} />
          <Line type="monotone" dataKey="realista" stroke="#00C49F" strokeWidth={3} name="Cenário Realista (6%)" dot={false} />
          <Line type="monotone" dataKey="otimista" stroke="#0088FE" strokeWidth={2} name="Cenário Otimista (10%)" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

interface AllocationProps {
  assets: Asset[];
}

export const AllocationChart: React.FC<AllocationProps> = ({ assets }) => {
  if (!assets) return null;

  // Agrupa os ativos por tipo
  const rawData = assets.reduce((acc: any[], asset) => {
    const existing = acc.find(a => a.name === asset.type);
    if (existing) {
      existing.value += asset.totalValue;
    } else {
      acc.push({ name: asset.type, value: asset.totalValue });
    }
    return acc;
  }, []);

  // Filtra itens zerados e ordena do maior para o menor
  const data = rawData
    .filter((item: any) => item.value > 0.01)
    .sort((a: any, b: any) => b.value - a.value);
    
  if (data.length === 0) return <div className="h-64 w-full flex items-center justify-center text-gray-400 text-xs">Nenhum ativo alocado</div>;

  return (
    <div className="h-64 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.3} />
          <XAxis type="number" tickFormatter={(val) => `R$${(val/1000).toFixed(0)}k`} />
          <YAxis 
            type="category" 
            dataKey="name" 
            width={120} 
            tick={{fontSize: 12, fontWeight: 600, fill: '#4B5563'}} 
          />
          <Tooltip 
            cursor={{fill: 'transparent'}}
            formatter={(val: number) => `R$ ${val.toLocaleString('pt-BR')}`} 
          />
          <Bar dataKey="value" name="Valor Alocado" radius={[0, 4, 4, 0]} barSize={30}>
            {data.map((entry: any, index: number) => {
              // Lógica de Cores Personalizada
              const nameLower = entry.name.toLowerCase();
              let fill = COLORS[index % COLORS.length]; // Cor padrão do ciclo

              if (nameLower.includes('poupança')) {
                fill = '#10B981'; // Verde (Emerald)
              } else if (nameLower.includes('corrente')) {
                fill = '#EF4444'; // Vermelho
              } else if (nameLower.includes('ação') || nameLower.includes('ações')) {
                fill = '#3B82F6'; // Azul
              } else if (nameLower.includes('fii')) {
                fill = '#F59E0B'; // Amarelo/Laranja
              }

              return <Cell key={`cell-${index}`} fill={fill} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Alterado para receber dados prontos { name: string, value: number }[]
interface ExpensesProps {
  data: { name: string; value: number }[];
}

export const ExpensesBarChart: React.FC<ExpensesProps> = ({ data }) => {
  if (!data || data.length === 0) return <div className="h-64 w-full flex items-center justify-center text-gray-400 text-xs">Sem dados de despesas</div>;

  // Ordena do maior para o menor para melhor visualização no gráfico
  const sortedData = [...data].sort((a, b) => b.value - a.value);

  return (
    <div className="h-64 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sortedData} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={true} vertical={false} />
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={120} tick={{fontSize: 11}} />
          <Tooltip formatter={(val: number) => `R$ ${val.toLocaleString('pt-BR')}`} />
          <Bar dataKey="value" fill="#8884d8" radius={[0, 4, 4, 0]}>
             {sortedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
