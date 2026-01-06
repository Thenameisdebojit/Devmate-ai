#include<stdio.h>
#include<stdlib.h>
struct Node {
    int data;
    struct Node* next;
};
struct Node* linkedlisttraversal(struct Node* ptr){
    while(ptr!=NULL){
        printf(" Element is %d\n", ptr->data);
        ptr=ptr->next;
    }
    return ptr;
}
struct Node* insertAtFirst(struct Node* head,int data){
    struct Node* ptr=(struct Node*)malloc(sizeof(struct Node));
    ptr->data=data;
    ptr->next=head;
    head=ptr;
    return head;
}
struct Node* insertAtIndex(struct Node* head,int data,int index){
    struct Node* ptr=(struct Node*)malloc(sizeof(struct Node));
    ptr->data=data;
    struct Node* p=head;
    int i=0;
    while(i!=index-1){
        p=p->next;
        i++;
    }
    ptr->next=p->next;
    p->next=ptr;
    return head;
}
struct Node* insertAtEnd(struct Node* head ,int data){ 
    struct Node* ptr=(struct Node*)malloc(sizeof(struct Node));
    ptr->data=data;
    struct Node* p=head;
    while(p->next!=NULL){
        p=p->next;
    }
    p->next=ptr;
    ptr->next=NULL;
    return head;
}

int main(){
    struct Node* head;
    struct Node* second;
    struct Node* third;
    struct Node* fourth;

    head=(struct Node*)malloc(sizeof(struct Node));
    second=(struct Node*)malloc(sizeof(struct Node));
    third=(struct Node*)malloc(sizeof(struct Node));
    fourth=(struct Node*)malloc(sizeof(struct Node));

    head->data=1;
    head->next=second;

    second->data=2;
    second->next=third;

    third->data=6;
    third->next=fourth;

    fourth->data=4;
    fourth->next=NULL;
    linkedlisttraversal(head);
    printf("\nlinkedlist after insertion\n");
    //head=insertAtFirst(head,56);
    //head=insertAtIndex(head,56,2);
    head=insertAtEnd(head,56);
    linkedlisttraversal(head);
    return 0;
}