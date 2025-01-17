import React from 'react';
import { getBezierPath, EdgeLabelRenderer } from 'reactflow';

/**
 *
 *Im Falle von konkurierenden übereinanderliegende Edge-Labels benötigen wir leicht verschobene Labels der Übergänge
 * Dafür kommen CustomEdges zum einsatz mit einem offset für die Symbole
 * @param id
 * @param sourceX
 * @param sourceY
 * @param targetX
 * @param targetY
 * @param sourcePosition
 * @param targetPosition
 * @param style
 * @param data
 * @param arrowHeadType
 * @param markerEnd
 * @returns {JSX.Element}
 * @constructor
 */

const CustomEdge = ({
                        id,
                        sourceX,
                        sourceY,
                        targetX,
                        targetY,
                        sourcePosition,
                        targetPosition,
                        style = {},
                        data,
                        arrowHeadType,
                        markerEnd,
                    }) => {
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const offset = 0.3; // Damit kann ich das LAbel die Kante entlang positionieren
    const adjustedLabelX = labelX + (targetX - sourceX) * (offset - 0.5);
    const adjustedLabelY = labelY + (targetY - sourceY) * (offset - 0.5);

    return (
        <>
            <path
                id={id}
                style={style}
                className="react-flow__edge-path"
                d={edgePath}
                markerEnd={markerEnd}
            />
            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -40%) translate(${adjustedLabelX}px, ${adjustedLabelY}px)`,
                        pointerEvents: 'all',
                        fontSize: '11px',
                        fontFamily: 'Arial, sans-serif',
                    }}
                    className="nodrag nopan"
                >
                    {data.label}
                </div>
            </EdgeLabelRenderer>
        </>
    );
};

export default CustomEdge;
