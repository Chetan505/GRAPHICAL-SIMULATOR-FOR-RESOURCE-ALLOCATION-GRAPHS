#include <iostream>
#include <vector>
#include <string>
#include <map>
#include <unordered_map>
#include <set>
#include <algorithm>

using namespace std;

enum class NodeType {
    PROCESS,
    RESOURCE
};

struct Node {
    string id;
    NodeType type;
    int instances;  // For resources
    
    Node(string id, NodeType type, int instances = 1)
        : id(id), type(type), instances(instances) {}
};

struct Edge {
    string from;
    string to;
    string type;  // "allocation" or "request"
    
    Edge(string from, string to, string type)
        : from(from), to(to), type(type) {}
};

class ResourceAllocationGraph {
private:
    unordered_map<string, Node> nodes;
    vector<Edge> edges;
    
public:
    void addNode(const string& id, NodeType type, int instances = 1) {
        nodes[id] = Node(id, type, instances);
        cout << (type == NodeType::PROCESS ? "Process" : "Resource") 
             << " \"" << id << "\" added." << endl;
    }
    
    void addEdge(const string& from, const string& to, const string& type) {
        // Check if nodes exist
        if (nodes.find(from) == nodes.end() || nodes.find(to) == nodes.end()) {
            cout << "Error: One or both nodes don't exist!" << endl;
            return;
        }
        
        // Validate edge type
        if ((nodes[from].type == NodeType::PROCESS && nodes[to].type == NodeType::RESOURCE && type == "request") ||
            (nodes[from].type == NodeType::RESOURCE && nodes[to].type == NodeType::PROCESS && type == "allocation")) {
            edges.push_back(Edge(from, to, type));
            cout << (type == "allocation" ? "Allocation" : "Request") 
                 << " edge added: " << from << " -> " << to << endl;
        } else {
            cout << "Invalid edge type!" << endl;
        }
    }
    
    bool detectDeadlock() {
        // Build adjacency list
        map<string, vector<string>> adj;
        
        for (const auto& edge : edges) {
            adj[edge.from].push_back(edge.to);
        }
        
        // DFS for cycle detection
        map<string, bool> visited;
        map<string, bool> recStack;
        vector<string> cycle;
        
        for (const auto& node_pair : nodes) {
            if (dfs(node_pair.first, adj, visited, recStack, cycle)) {
                cout << "\n🚨 DEADLOCK DETECTED!" << endl;
                cout << "Cycle: ";
                for (size_t i = 0; i < cycle.size(); ++i) {
                    cout << cycle[i];
                    if (i != cycle.size() - 1) cout << " -> ";
                }
                cout << endl;
                return true;
            }
        }
        
        cout << "\n✅ System is deadlock-free" << endl;
        return false;
    }
    
    void printGraph() {
        cout << "\n=== Resource Allocation Graph ===" << endl;
        cout << "Nodes (" << nodes.size() << "):" << endl;
        for (const auto& node_pair : nodes) {
            const Node& node = node_pair.second;
            cout << "  " << node.id << " [" 
                 << (node.type == NodeType::PROCESS ? "Process" : "Resource");
            if (node.type == NodeType::RESOURCE) {
                cout << ", Instances: " << node.instances;
            }
            cout << "]" << endl;
        }
        
        cout << "\nEdges (" << edges.size() << "):" << endl;
        for (const auto& edge : edges) {
            cout << "  " << edge.from << " -> " << edge.to 
                 << " [" << edge.type << "]" << endl;
        }
    }
    
private:
    bool dfs(const string& node, 
             map<string, vector<string>>& adj,
             map<string, bool>& visited,
             map<string, bool>& recStack,
             vector<string>& path) {
        
        if (!visited[node]) {
            visited[node] = true;
            recStack[node] = true;
            path.push_back(node);
            
            for (const string& neighbor : adj[node]) {
                if (!visited[neighbor] && dfs(neighbor, adj, visited, recStack, path)) {
                    return true;
                } else if (recStack[neighbor]) {
                    // Cycle found
                    auto it = find(path.begin(), path.end(), neighbor);
                    if (it != path.end()) {
                        path.erase(path.begin(), it);
                    }
                    return true;
                }
            }
            
            path.pop_back();
        }
        recStack[node] = false;
        return false;
    }
};

int main() {
    ResourceAllocationGraph rag;
    
    // Example: Classic deadlock scenario
    cout << "=== Setting up a deadlock scenario ===" << endl;
    
    // Add processes
    rag.addNode("P1", NodeType::PROCESS);
    rag.addNode("P2", NodeType::PROCESS);
    
    // Add resources
    rag.addNode("R1", NodeType::RESOURCE, 1);
    rag.addNode("R2", NodeType::RESOURCE, 1);
    
    // Create deadlock cycle: P1 -> R1 -> P2 -> R2 -> P1
    rag.addEdge("P1", "R1", "request");    // P1 requests R1
    rag.addEdge("R1", "P2", "allocation"); // R1 allocated to P2
    rag.addEdge("P2", "R2", "request");    // P2 requests R2
    rag.addEdge("R2", "P1", "allocation"); // R2 allocated to P1
    
    rag.printGraph();
    rag.detectDeadlock();
    
    cout << "\n=== Setting up a deadlock-free scenario ===" << endl;
    ResourceAllocationGraph rag2;
    
    rag2.addNode("P1", NodeType::PROCESS);
    rag2.addNode("P2", NodeType::PROCESS);
    rag2.addNode("R1", NodeType::RESOURCE, 2); // Multiple instances
    
    rag2.addEdge("P1", "R1", "request");
    rag2.addEdge("R1", "P1", "allocation");
    rag2.addEdge("P2", "R1", "request");
    rag2.addEdge("R1", "P2", "allocation");
    
    rag2.printGraph();
    rag2.detectDeadlock();
    
    return 0;
}