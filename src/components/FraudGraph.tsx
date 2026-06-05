import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const nodes = [
    {id: "andrew_do", name: "Andrew Hoang Do", type: "political", group: 1, size: 30, info: "Former Supervisor | Sentenced 60 months | $14M steered"},
    {id: "pham", name: "Peter Anh Pham", type: "shell_op", group: 2, size: 25, info: "VAS Operator | Fugitive in Taiwan | 15-count indictment"},
    {id: "nguyen", name: "Thanh Huong Nguyen", type: "shell_op", group: 2, size: 22, info: "H2H Leader | Arraigned | $2M contract"},
    {id: "rhiannon", name: "Rhiannon Do", type: "family", group: 3, size: 20, info: "Daughter | $381.5K property | $8K/month"},
    {id: "ilene", name: "Ilene Do", type: "family", group: 3, size: 18, info: "Daughter | $100K total | 4x $25K checks"},
    {id: "dimarcello", name: "Anthony DiMarcello", type: "whistleblower", group: 4, size: 24, info: "Whistleblower | 5150 hold | Forced medication"},
    {id: "wangsaporn", name: "Chris Wangsaporn", type: "political", group: 1, size: 20, info: "Chief of Staff | Processed fraudulent contracts"},
    {id: "vas", name: "Viet America Society", type: "shell", group: 2, size: 28, info: "Nonprofit Shell | $12M+ received | Primary conduit"},
    {id: "h2h", name: "Hand to Hand Relief", type: "shell", group: 2, size: 24, info: "Nonprofit Shell | $2M SLFRF contract"},
    {id: "dair", name: "D Air Conditioning", type: "shell", group: 2, size: 22, info: "Laundering conduit | $256K | Issued checks to Ilene Do"},
    {id: "aloha", name: "Aloha Financial", type: "shell", group: 2, size: 22, info: "Perfume River | $315K | $8K/month to Rhiannon"},
    {id: "mercy", name: "Mercy House", type: "operator", group: 5, size: 26, info: "Shelter Operator | HBNC | Toxic site exposure"},
    {id: "hbnc", name: "Huntington Beach Navigation Center", type: "location", group: 6, size: 24, info: "Toxic waste site | 49x Chromium limit | Environmental racism"},
    {id: "shea", name: "Shea Homes", type: "operator", group: 5, size: 20, info: "Developer | Retaliatory eviction | 99Homes pattern"},
    {id: "tiempo", name: "Tiempo Escrow", type: "operator", group: 5, size: 18, info: "Escrow facilitator | Rapid title transfers"},
    {id: "burns", name: "Pat Burns", type: "political", group: 1, size: 20, info: "Mayor | Disinheritance scheme | Housing Authority"},
    {id: "higdon", name: "Craig Higdon", type: "shell_op", group: 2, size: 18, info: "Money exit node | Naples FL | Operation Hard Money"}
];

const links = [
    {source: "andrew_do", target: "vas", type: "steered", value: 12, label: "$12M steered"},
    {source: "andrew_do", target: "h2h", type: "steered", value: 2, label: "$2M steered"},
    {source: "andrew_do", target: "rhiannon", type: "family", value: 1},
    {source: "andrew_do", target: "ilene", type: "family", value: 1},
    {source: "pham", target: "vas", type: "operates", value: 3},
    {source: "nguyen", target: "h2h", type: "operates", value: 3},
    {source: "pham", target: "nguyen", type: "conspirator", value: 2},
    {source: "vas", target: "dair", type: "laundering", value: 3, label: "$256K"},
    {source: "vas", target: "aloha", type: "laundering", value: 3, label: "$315K"},
    {source: "dair", target: "ilene", type: "bribe", value: 2, label: "$100K"},
    {source: "aloha", target: "rhiannon", type: "bribe", value: 2, label: "$381.5K"},
    {source: "wangsaporn", target: "vas", type: "paperwork", value: 2},
    {source: "mercy", target: "hbnc", type: "operates", value: 3},
    {source: "shea", target: "dimarcello", type: "retaliation", value: 2, label: "Eviction"},
    {source: "burns", target: "shea", type: "coordinates", value: 1},
    {source: "higdon", target: "vas", type: "money_exit", value: 2, label: "Florida node"},
    {source: "tiempo", target: "shea", type: "facilitates", value: 1}
];

const colors = {
    political: "#e74c3c",
    shell_op: "#e67e22",
    shell: "#f39c12",
    family: "#3498db",
    whistleblower: "#9b59b6",
    operator: "#2ecc71",
    location: "#1abc9c"
};

const FraudGraph: React.FC = () => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!svgRef.current || !containerRef.current) return;

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const g = svg.append("g");

        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            });

        svg.call(zoom);

        const simulation = d3.forceSimulation(nodes as any)
            .force("link", d3.forceLink(links as any).id((d: any) => d.id).distance(150))
            .force("charge", d3.forceManyBody().strength(-500))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collision", d3.forceCollide().radius((d: any) => d.size + 10));

        const link = g.append("g")
            .selectAll("line")
            .data(links)
            .join("line")
            .attr("class", "link")
            .attr("stroke", (d: any) => {
                if (d.type === "bribe" || d.type === "laundering") return "#e74c3c";
                if (d.type === "steered") return "#3498db";
                if (d.type === "retaliation") return "#9b59b6";
                return "#666";
            })
            .attr("stroke-width", (d: any) => Math.sqrt(d.value) * 2)
            .attr("stroke-dasharray", (d: any) => d.type === "family" ? "5,5" : null);

        const node = g.append("g")
            .selectAll("circle")
            .data(nodes)
            .join("circle")
            .attr("class", "node")
            .attr("r", (d: any) => d.size)
            .attr("fill", (d: any) => colors[d.type as keyof typeof colors] || "#666")
            .call(d3.drag<SVGCircleElement, any>()
                .on("start", (event, d) => {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on("drag", (event, d) => {
                    d.fx = event.x;
                    d.fy = event.y;
                })
                .on("end", (event, d) => {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                }) as any);

        const labels = g.append("g")
            .selectAll("text")
            .data(nodes)
            .join("text")
            .attr("class", "node-label")
            .attr("text-anchor", "middle")
            .attr("dy", (d: any) => d.size + 15)
            .text((d: any) => d.name.length > 15 ? d.name.substring(0, 15) + "..." : d.name);

        simulation.on("tick", () => {
            link
                .attr("x1", (d: any) => d.source.x)
                .attr("y1", (d: any) => d.source.y)
                .attr("x2", (d: any) => d.target.x)
                .attr("y2", (d: any) => d.target.y);

            node
                .attr("cx", (d: any) => d.x)
                .attr("cy", (d: any) => d.y);

            labels
                .attr("x", (d: any) => d.x)
                .attr("y", (d: any) => d.y);
        });

    }, []);

    return (
        <div ref={containerRef} className="w-full h-full">
            <svg ref={svgRef} className="w-full h-full"></svg>
        </div>
    );
};

export default FraudGraph;
